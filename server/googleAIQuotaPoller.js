import { GoogleAuth } from 'google-auth-library'

const POLL_INTERVAL = 60 * 1000 // 60 seconds — matches Cloud Monitoring 1-min resolution

// Static Tier 1 fallback limits (used when Service Usage API is unavailable)
// Source: https://ai.google.dev/gemini-api/docs/rate-limits
const MODEL_REGISTRY = [
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    tier: 'stable',
    // Quota metric label substrings used to match Cloud Monitoring time-series
    labelMatchers: ['2.5-pro', '2-5-pro', 'gemini25pro', 'gemini-2.5-pro'],
    fallbackLimits: { rpm: 150, tpm: 2_000_000, rpd: 1_500 }
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    tier: 'stable',
    labelMatchers: ['2.5-flash-lite', '2-5-flash-lite', 'gemini25flashlite', 'flash-lite'],
    // Note: flash-lite matchers listed before flash to avoid substring collision
    fallbackLimits: { rpm: 300, tpm: 2_000_000, rpd: 1_500 }
  },
  {
    id: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    tier: 'stable',
    labelMatchers: ['2.5-flash', '2-5-flash', 'gemini25flash', 'gemini-2.5-flash'],
    fallbackLimits: { rpm: 300, tpm: 2_000_000, rpd: 1_500 }
  },
  {
    id: 'gemini-3-preview',
    displayName: 'Gemini 3.x Preview',
    tier: 'preview',
    labelMatchers: ['gemini-3', 'gemini3', '3.x', 'preview', 'exp'],
    fallbackLimits: { rpm: 150, tpm: 2_000_000, rpd: 250 }
  }
]

function nextMinuteBoundary() {
  const now = new Date()
  now.setSeconds(0, 0)
  now.setMinutes(now.getMinutes() + 1)
  return now.toISOString()
}

function nextMidnightUTC() {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.toISOString()
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function matchModelByLabel(quotaMetricLabel) {
  const label = (quotaMetricLabel || '').toLowerCase()
  // Test flash-lite before flash to avoid substring match collision
  const orderedRegistry = [
    MODEL_REGISTRY[2], // flash-lite
    MODEL_REGISTRY[0], // pro
    MODEL_REGISTRY[1], // flash
    MODEL_REGISTRY[3]  // preview
  ]
  for (const model of orderedRegistry) {
    if (model.labelMatchers.some(m => label.includes(m))) {
      return model.id
    }
  }
  return null
}

export class GoogleAIQuotaPoller {
  constructor(onUpdate) {
    this.onUpdate = onUpdate
    this.cachedQuota = null
    this.lastError = null
    this.pollTimer = null
    this.auth = null
    this.configured = false
  }

  async start() {
    const projectId = process.env.GOOGLE_PROJECT_ID
    if (!projectId) {
      this.configured = false
      this.lastError = 'GOOGLE_PROJECT_ID environment variable not set'
      console.log('[GoogleAIQuota] Not configured — set GOOGLE_PROJECT_ID to enable')
      return
    }

    this.configured = true
    this.projectId = projectId

    try {
      this.auth = new GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/monitoring.read',
          'https://www.googleapis.com/auth/cloud-platform.read-only'
        ]
      })
    } catch (err) {
      this.lastError = `Auth init failed: ${err.message}`
      console.error('[GoogleAIQuota] Failed to initialize auth:', err.message)
      return
    }

    await this.fetchQuota()
    this.pollTimer = setInterval(() => this.fetchQuota(), POLL_INTERVAL)
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer)
  }

  async getAccessToken() {
    const client = await this.auth.getClient()
    const token = await client.getAccessToken()
    return token.token
  }

  async fetchTimeSeries(metricType, accessToken) {
    const now = new Date()
    const startTime = new Date(now.getTime() - 3 * 60 * 1000).toISOString() // last 3 minutes
    const endTime = now.toISOString()

    const filter = [
      `metric.type="${metricType}"`,
      `resource.labels.service="generativelanguage.googleapis.com"`
    ].join(' AND ')

    const params = new URLSearchParams({
      filter,
      'interval.startTime': startTime,
      'interval.endTime': endTime,
      'aggregation.alignmentPeriod': '60s',
      'aggregation.perSeriesAligner': 'ALIGN_MEAN'
    })

    const url = `https://monitoring.googleapis.com/v3/projects/${this.projectId}/timeSeries?${params}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Monitoring API ${response.status}: ${text.slice(0, 200)}`)
    }

    return response.json()
  }

  async fetchQuotaLimits(accessToken) {
    const url = `https://serviceusage.googleapis.com/v1beta1/projects/${this.projectId}/services/generativelanguage.googleapis.com/consumerQuotaMetrics?view=FULL`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!response.ok) {
      // Non-fatal — fall back to static limits
      console.warn(`[GoogleAIQuota] Service Usage API ${response.status} — using fallback limits`)
      return null
    }

    return response.json()
  }

  extractLimitsFromServiceUsage(serviceUsageData) {
    // Returns { modelId: { rpm: number, tpm: number, rpd: number } } or null
    if (!serviceUsageData?.metrics) return null
    const limits = {}
    // TODO: parse serviceUsageData.metrics once label format is known from live API
    // For now return null to use fallback limits
    return Object.keys(limits).length > 0 ? limits : null
  }

  parseTimeSeries(timeSeriesData, metricDimension) {
    // Returns { modelId: usedValue }
    const result = {}
    const series = timeSeriesData?.timeSeries || []

    // Log label names on first successful fetch to assist calibration
    if (series.length > 0 && !this._labelLogged) {
      this._labelLogged = true
      const labels = series.map(s => s.metric?.labels?.quota_metric || s.metric?.labels || '')
      console.log(`[GoogleAIQuota] Discovered quota_metric labels (${metricDimension}):`, labels)
    }

    for (const ts of series) {
      const quotaMetric = ts.metric?.labels?.quota_metric || ''
      const modelId = matchModelByLabel(quotaMetric)
      if (!modelId) continue

      // Take the most recent data point
      const points = ts.points || []
      if (points.length === 0) continue
      const latest = points[0]
      const value = latest.value?.int64Value || latest.value?.doubleValue || 0
      result[modelId] = (result[modelId] || 0) + Number(value)
    }

    return result
  }

  buildPayload(rpmUsage, tpmUsage, rpdUsage, apiLimits) {
    const models = MODEL_REGISTRY.map(model => {
      const fallback = model.fallbackLimits
      const limits = apiLimits?.[model.id] || fallback

      const rpmUsed = rpmUsage[model.id] || 0
      const tpmUsed = tpmUsage[model.id] || 0
      const rpdUsed = rpdUsage[model.id] || 0

      const limitSource = apiLimits?.[model.id] ? 'api' : 'fallback'

      return {
        id: model.id,
        displayName: model.displayName,
        tier: model.tier,
        rpm: {
          used: Math.round(rpmUsed),
          limit: limits.rpm,
          utilization: clamp(Math.round((rpmUsed / limits.rpm) * 100), 0, 100),
          windowResetsAt: nextMinuteBoundary(),
          limitSource
        },
        tpm: {
          used: Math.round(tpmUsed),
          limit: limits.tpm,
          utilization: clamp(Math.round((tpmUsed / limits.tpm) * 100), 0, 100),
          windowResetsAt: nextMinuteBoundary(),
          limitSource
        },
        rpd: {
          used: Math.round(rpdUsed),
          limit: limits.rpd,
          utilization: clamp(Math.round((rpdUsed / limits.rpd) * 100), 0, 100),
          windowResetsAt: nextMidnightUTC(),
          limitSource
        }
      }
    })

    return { models }
  }

  async fetchQuota() {
    try {
      const accessToken = await this.getAccessToken()

      // Fetch rate (RPM/TPM) and allocation (RPD) metrics in parallel
      const [rpmData, tpmData, rpdData, limitsData] = await Promise.all([
        this.fetchTimeSeries('serviceruntime.googleapis.com/quota/rate/net_usage', accessToken),
        this.fetchTimeSeries('serviceruntime.googleapis.com/quota/rate/net_usage', accessToken),
        this.fetchTimeSeries('serviceruntime.googleapis.com/quota/allocation/usage', accessToken),
        this.fetchQuotaLimits(accessToken)
      ])

      const rpmUsage = this.parseTimeSeries(rpmData, 'rpm')
      const tpmUsage = this.parseTimeSeries(tpmData, 'tpm')
      const rpdUsage = this.parseTimeSeries(rpdData, 'rpd')
      const apiLimits = this.extractLimitsFromServiceUsage(limitsData)

      const data = this.buildPayload(rpmUsage, tpmUsage, rpdUsage, apiLimits)

      const enriched = {
        configured: true,
        data,
        error: null,
        fetchedAt: new Date().toISOString()
      }

      const changed = JSON.stringify(this.cachedQuota?.data) !== JSON.stringify(data)
      this.cachedQuota = enriched
      this.lastError = null

      if (changed) this.onUpdate(enriched)
    } catch (err) {
      this.lastError = `API: ${err.message}`
      console.error('[GoogleAIQuota] Fetch failed:', err.message)

      const errPayload = {
        configured: true,
        data: this.cachedQuota?.data || null,
        error: this.lastError,
        fetchedAt: new Date().toISOString()
      }

      this.cachedQuota = errPayload
      this.onUpdate(errPayload)
    }
  }

  getQuota() {
    if (!this.configured) {
      return {
        configured: false,
        data: null,
        error: this.lastError || 'GOOGLE_PROJECT_ID environment variable not set',
        fetchedAt: null
      }
    }
    if (this.cachedQuota) return this.cachedQuota
    return {
      configured: true,
      data: null,
      error: this.lastError || 'No data yet',
      fetchedAt: null
    }
  }
}
