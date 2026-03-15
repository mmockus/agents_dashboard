import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json')
const USAGE_API_URL = 'https://api.anthropic.com/api/oauth/usage'
const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
const BETA_HEADER = 'oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14'

export class SubscriptionPoller {
  constructor(onUpdate) {
    this.onUpdate = onUpdate
    this.cachedUsage = null
    this.lastError = null
    this.pollTimer = null
  }

  async start() {
    await this.fetchUsage()
    this.pollTimer = setInterval(() => this.fetchUsage(), POLL_INTERVAL)
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer)
  }

  async readCredentials() {
    // Try macOS Keychain first (newer Claude Code stores creds there)
    try {
      const { stdout } = await execAsync(
        'security find-generic-password -s "Claude Code-credentials" -g 2>&1 | grep "^password:" | sed \'s/^password: "//;s/"$//\''
      )
      const raw = stdout.trim()
      if (raw) {
        const creds = JSON.parse(raw)
        const oauth = creds.claudeAiOauth
        if (oauth?.accessToken) {
          if (oauth.expiresAt && oauth.expiresAt < Date.now()) {
            throw new Error('Access token has expired')
          }
          return oauth
        }
      }
    } catch (keychainErr) {
      // Fall through to file-based credentials
    }

    // Fall back to file-based credentials
    try {
      const raw = await readFile(CREDENTIALS_PATH, 'utf-8')
      const creds = JSON.parse(raw)
      const oauth = creds.claudeAiOauth
      if (!oauth?.accessToken) {
        throw new Error('No access token found in credentials')
      }
      if (oauth.expiresAt && oauth.expiresAt < Date.now()) {
        throw new Error('Access token has expired')
      }
      return oauth
    } catch (err) {
      this.lastError = `Credentials: ${err.message}`
      return null
    }
  }

  async fetchUsage() {
    const oauth = await this.readCredentials()
    if (!oauth) {
      this.onUpdate({
        error: this.lastError,
        data: null,
        fetchedAt: new Date().toISOString()
      })
      return
    }

    try {
      const response = await fetch(USAGE_API_URL, {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`,
          'anthropic-beta': BETA_HEADER
        }
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API ${response.status}: ${text.slice(0, 200)}`)
      }

      const usage = await response.json()
      const enriched = {
        data: usage,
        subscriptionType: oauth.subscriptionType || null,
        rateLimitTier: oauth.rateLimitTier || null,
        fetchedAt: new Date().toISOString(),
        error: null
      }

      const changed = JSON.stringify(this.cachedUsage?.data) !== JSON.stringify(usage)
      this.cachedUsage = enriched
      this.lastError = null

      if (changed) this.onUpdate(enriched)
    } catch (err) {
      this.lastError = `API: ${err.message}`
      this.onUpdate({
        error: this.lastError,
        data: this.cachedUsage?.data || null,
        subscriptionType: this.cachedUsage?.subscriptionType || null,
        rateLimitTier: this.cachedUsage?.rateLimitTier || null,
        fetchedAt: new Date().toISOString()
      })
    }
  }

  getUsage() {
    if (this.cachedUsage) return this.cachedUsage
    return {
      data: null,
      error: this.lastError || 'No data yet',
      fetchedAt: null
    }
  }
}
