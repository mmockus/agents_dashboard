import { resolveCredentials } from './credentialResolver.js'

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
    const result = await resolveCredentials()
    if (!result.credentials) {
      this.lastError = result.error
    }
    return result.credentials
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
