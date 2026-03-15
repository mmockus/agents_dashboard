// Telemetry API client for Agents Dashboard

const API_URL = import.meta.env.VITE_TELEMETRY_URL || 'http://localhost:3001'
const WS_URL = API_URL.replace('http', 'ws')

class TelemetryClient {
  constructor() {
    this.ws = null
    this.listeners = new Set()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000
  }

  // Connect to WebSocket for real-time updates
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(WS_URL)

      this.ws.onopen = () => {
        console.log('[Telemetry] WebSocket connected')
        this.reconnectAttempts = 0
        this.notifyListeners({ type: 'connected' })
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.notifyListeners(message)
        } catch (e) {
          console.error('[Telemetry] Failed to parse message:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('[Telemetry] WebSocket disconnected')
        this.notifyListeners({ type: 'disconnected' })
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('[Telemetry] WebSocket error:', error)
      }
    } catch (e) {
      console.error('[Telemetry] Failed to connect:', e)
      this.attemptReconnect()
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Telemetry] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    console.log(`[Telemetry] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => this.connect(), delay)
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  // Subscribe to real-time updates
  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  notifyListeners(message) {
    this.listeners.forEach(callback => callback(message))
  }

  // REST API methods
  async getAgents() {
    try {
      const response = await fetch(`${API_URL}/api/agents`)
      if (!response.ok) throw new Error('Failed to fetch agents')
      return await response.json()
    } catch (error) {
      console.error('[Telemetry] Failed to fetch agents:', error)
      return []
    }
  }

  async getActivities(limit = 50, provider = 'all') {
    try {
      const params = new URLSearchParams({ limit: limit.toString() })
      if (provider !== 'all') params.set('provider', provider)

      const response = await fetch(`${API_URL}/api/activities?${params}`)
      if (!response.ok) throw new Error('Failed to fetch activities')
      return await response.json()
    } catch (error) {
      console.error('[Telemetry] Failed to fetch activities:', error)
      return []
    }
  }

  async getHealth() {
    try {
      const response = await fetch(`${API_URL}/api/health`)
      if (!response.ok) throw new Error('Server unhealthy')
      return await response.json()
    } catch (error) {
      return { ok: false, error: error.message }
    }
  }

  // Get subscription usage
  async getSubscription() {
    try {
      const response = await fetch(`${API_URL}/api/subscription`)
      if (!response.ok) throw new Error('Failed to fetch subscription')
      return await response.json()
    } catch (error) {
      console.error('[Telemetry] Failed to fetch subscription:', error)
      return { data: null, error: error.message }
    }
  }

  // Get Google AI quota usage
  async getGoogleQuota() {
    try {
      const response = await fetch(`${API_URL}/api/google-quota`)
      if (!response.ok) throw new Error('Failed to fetch Google AI quota')
      return await response.json()
    } catch (error) {
      console.error('[Telemetry] Failed to fetch Google AI quota:', error)
      return { configured: false, data: null, error: error.message, fetchedAt: null }
    }
  }

  // Check if server is available
  async isServerAvailable() {
    const health = await this.getHealth()
    return health.ok === true
  }

  // Get current rate limit status
  async getRateLimit() {
    try {
      const response = await fetch(`${API_URL}/api/rate-limit`)
      if (!response.ok) throw new Error('Failed to fetch rate limit')
      return await response.json()
    } catch (error) {
      console.error('[Telemetry] Failed to fetch rate limit:', error)
      return { isLimited: false }
    }
  }

  // Clear rate limit
  async clearRateLimit() {
    try {
      const response = await fetch(`${API_URL}/api/rate-limit`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to clear rate limit')
      return await response.json()
    } catch (error) {
      console.error('[Telemetry] Failed to clear rate limit:', error)
      return { ok: false }
    }
  }
}

// Singleton instance
export const telemetry = new TelemetryClient()

// React hook for using telemetry
export function useTelemetry() {
  return telemetry
}
