import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json')

/**
 * Validates an OAuthCredentials object.
 * Throws a descriptive error if the token is missing or expired.
 * @param {object} oauth
 * @returns {object} the validated oauth object
 */
function validateOAuthToken(oauth) {
  if (!oauth?.accessToken) {
    throw new Error('No access token found in credentials')
  }
  if (oauth.expiresAt && oauth.expiresAt < Date.now()) {
    throw new Error('Access token has expired')
  }
  return oauth
}

/**
 * Try to resolve credentials from the CLAUDE_CREDENTIALS environment variable.
 * The env var must be a JSON string containing a claudeAiOauth object.
 * @returns {object|null} OAuthCredentials or null
 */
export async function tryEnvVar() {
  const raw = process.env.CLAUDE_CREDENTIALS
  if (!raw) return null
  try {
    const creds = JSON.parse(raw)
    return validateOAuthToken(creds.claudeAiOauth)
  } catch {
    return null
  }
}

/**
 * Try to resolve credentials from the macOS Keychain (darwin only).
 * @returns {object|null} OAuthCredentials or null
 */
export async function tryMacKeychain() {
  if (process.platform !== 'darwin') return null
  try {
    const { stdout } = await execAsync(
      'security find-generic-password -s "Claude Code-credentials" -g 2>&1 | grep "^password:" | sed \'s/^password: "//;s/"$//\''
    )
    const raw = stdout.trim()
    if (!raw) return null
    const creds = JSON.parse(raw)
    return validateOAuthToken(creds.claudeAiOauth)
  } catch {
    return null
  }
}

/**
 * Try to resolve credentials from Windows Credential Manager (win32 only).
 * Uses a PowerShell subprocess — no new npm dependencies required.
 * @returns {object|null} OAuthCredentials or null
 */
export async function tryWindowsCredMan() {
  if (process.platform !== 'win32') return null
  try {
    // Try Windows.Security.Credentials.PasswordVault (available without extra modules)
    const psCmd =
      '$v=[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]::new();' +
      '($v.Retrieve("Claude Code-credentials",($v.FindAllByResource("Claude Code-credentials")|Select-Object -First 1).UserName)).Password'
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${psCmd}"`,
      { timeout: 5000 }
    )
    const raw = stdout.trim()
    if (!raw) return null
    const creds = JSON.parse(raw)
    return validateOAuthToken(creds.claudeAiOauth)
  } catch {
    return null
  }
}

/**
 * Try to resolve credentials from ~/.claude/.credentials.json (universal fallback).
 * On Windows, homedir() returns C:\Users\<name>, so the path resolves correctly.
 * @returns {object|null} OAuthCredentials or null
 */
export async function tryCredentialsFile() {
  try {
    const raw = await readFile(CREDENTIALS_PATH, 'utf-8')
    const creds = JSON.parse(raw)
    return validateOAuthToken(creds.claudeAiOauth)
  } catch {
    return null
  }
}

/**
 * Resolve Claude OAuth credentials from the highest-priority available source.
 *
 * Priority order:
 *   1. CLAUDE_CREDENTIALS env var  (all platforms; Docker / remote use case)
 *   2. macOS Keychain               (darwin only)
 *   3. Windows Credential Manager   (win32 only)
 *   4. ~/.claude/.credentials.json  (universal fallback)
 *
 * @returns {Promise<{credentials: object|null, resolvedBy: string|null, triedSources: string[], error: string|null}>}
 */
export async function resolveCredentials() {
  const sources = [
    { name: 'env var', fn: tryEnvVar },
    { name: 'macOS Keychain', fn: tryMacKeychain },
    { name: 'Windows Credential Manager', fn: tryWindowsCredMan },
    { name: 'file', fn: tryCredentialsFile },
  ]

  const triedSources = []

  for (const source of sources) {
    const credentials = await source.fn()
    if (credentials) {
      return { credentials, resolvedBy: source.name, triedSources, error: null }
    }
    triedSources.push(source.name)
  }

  const error =
    `Credentials not found. Tried: [${triedSources.join(', ')}].\n` +
    'To fix: set CLAUDE_CREDENTIALS env var or ensure ~/.claude/.credentials.json exists.'

  return { credentials: null, resolvedBy: null, triedSources, error }
}
