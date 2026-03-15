# Data Model: Cross-Platform and Docker Deployment Support

**Feature**: 002-cross-platform-docker
**Date**: 2026-03-15

---

## Entities

### CredentialSource

Represents a single strategy for obtaining Claude OAuth credentials.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable identifier (e.g., "macOS Keychain", "env var", "file") |
| `platform` | string or null | Required host OS (`darwin`, `win32`) or null if universal |
| `priority` | number | Lower = higher priority (1 = env var, 2 = Keychain, 3 = Windows, 4 = file) |

State transitions: each source either returns a valid `OAuthCredentials` object or throws/returns null, causing the resolver to advance to the next source.

---

### OAuthCredentials

The credential payload extracted from any source. Shape is identical regardless of which source provided it.

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | string | Bearer token for Anthropic API calls |
| `expiresAt` | number or undefined | Unix timestamp (ms); undefined means no expiry |
| `subscriptionType` | string or null | Claude plan tier |
| `rateLimitTier` | string or null | API rate limit tier |

**Validation rules**:
- `accessToken` must be a non-empty string
- If `expiresAt` is present, it must be greater than `Date.now()`; otherwise the token is rejected with a clear error
- `subscriptionType` and `rateLimitTier` are optional metadata — missing values are acceptable

---

### CredentialResolutionResult

Returned by the resolver on success or failure.

| Field | Type | Description |
|-------|------|-------------|
| `credentials` | OAuthCredentials or null | Resolved credentials, or null on failure |
| `resolvedBy` | string or null | Name of the source that succeeded |
| `triedSources` | string[] | Names of all sources attempted before success or exhaustion |
| `error` | string or null | Human-readable message when credentials is null |

---

## Module Boundary

`credentialResolver.js` owns the credential resolution lifecycle. `subscriptionPoller.js` calls `resolveCredentials()` and consumes `CredentialResolutionResult`. No other module reads credentials directly.

```
SubscriptionPoller
    │
    └── credentialResolver.resolveCredentials()
            │
            ├── tryEnvVar()          → OAuthCredentials | null
            ├── tryMacKeychain()     → OAuthCredentials | null  (darwin only)
            ├── tryWindowsCredMan()  → OAuthCredentials | null  (win32 only)
            └── tryCredentialsFile() → OAuthCredentials | null  (universal fallback)
```
