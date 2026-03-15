import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Clock, AlertTriangle, TrendingUp, Zap, Database } from 'lucide-react'

function getUtilizationColor(pct) {
  if (pct >= 90) return { text: 'text-error', bar: 'bg-error' }
  if (pct >= 75) return { text: 'text-pending', bar: 'bg-pending' }
  if (pct >= 50) return { text: 'text-pending', bar: 'bg-pending' }
  return { text: 'text-active', bar: 'bg-active' }
}

function formatCountdown(resetsAt) {
  if (!resetsAt) return { countdown: '', resetTime: '' }
  const resetDate = new Date(resetsAt)
  const diff = resetDate.getTime() - Date.now()

  const resetTime = resetDate.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  if (diff <= 0) return { countdown: 'Resetting...', resetTime }

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  let countdown
  if (days > 0) {
    countdown = `${days}d ${hours}h`
  } else if (hours > 0) {
    countdown = `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    countdown = `${minutes}m`
  } else {
    countdown = `${seconds}s`
  }

  return { countdown, resetTime }
}

function formatCount(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

const METRIC_ICONS = {
  RPM: Zap,
  TPM: Database,
  RPD: TrendingUp
}

function QuotaBar({ label, metric }) {
  const pct = Math.round(metric.utilization || 0)
  const colors = getUtilizationColor(pct)
  const isLimited = pct >= 100
  const [timeInfo, setTimeInfo] = useState(formatCountdown(metric.windowResetsAt))
  const IconComponent = METRIC_ICONS[label] || Zap

  useEffect(() => {
    if (!metric.windowResetsAt) return
    const timer = setInterval(() => setTimeInfo(formatCountdown(metric.windowResetsAt)), 1000)
    setTimeInfo(formatCountdown(metric.windowResetsAt))
    return () => clearInterval(timer)
  }, [metric.windowResetsAt])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IconComponent className={`w-3 h-3 ${colors.text}`} />
          <span className="font-mono text-xs text-silver">{label}</span>
          <span className="font-mono text-[10px] text-idle">
            {formatCount(metric.used)}/{formatCount(metric.limit)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs font-medium ${colors.text}`}>{pct}%</span>
          {timeInfo.countdown && (
            <span className="font-mono text-[10px] text-idle flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {timeInfo.countdown}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-steel/30 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colors.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {timeInfo.resetTime && (
        <div className={`font-mono text-[10px] ${isLimited ? 'text-error' : 'text-idle'}`}>
          {isLimited ? 'Unlocks: ' : 'Resets: '}{timeInfo.resetTime}
        </div>
      )}
    </div>
  )
}

function ModelSection({ model }) {
  const isIdle = model.rpm.utilization === 0 &&
    model.tpm.utilization === 0 &&
    model.rpd.utilization === 0

  return (
    <div className={`space-y-2 transition-opacity duration-200 ${isIdle ? 'opacity-40' : 'opacity-100'}`}>
      {/* Model header */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-silver font-medium">{model.displayName}</span>
        {model.tier === 'preview' && (
          <span className="flex items-center gap-0.5 font-mono text-[9px] text-pending bg-pending/10 px-1 py-0.5 rounded">
            <AlertTriangle className="w-2.5 h-2.5" />
            Preview
          </span>
        )}
        {isIdle && (
          <span className="font-mono text-[9px] text-idle ml-auto">idle</span>
        )}
      </div>

      {/* Quota bars — always show all 3 dimensions */}
      {!isIdle && (
        <div className="space-y-1.5 pl-2">
          <QuotaBar label="RPM" metric={model.rpm} />
          <QuotaBar label="TPM" metric={model.tpm} />
          <QuotaBar label="RPD" metric={model.rpd} />
        </div>
      )}
      {isIdle && (
        <div className="pl-2 font-mono text-[10px] text-idle">
          RPM {model.rpm.used} · TPM {formatCount(model.tpm.used)} · RPD {model.rpd.used}
        </div>
      )}
    </div>
  )
}

function GoogleAIUsage({ googleQuota }) {
  // State: null/undefined → loading/no data yet → render nothing
  if (!googleQuota) return null

  const { configured, data, error, fetchedAt } = googleQuota

  // State: not configured
  if (!configured) {
    return (
      <div className="bg-carbon/60 border border-steel/50 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate/30 border-b border-steel/30">
          <Sparkles className="w-3.5 h-3.5 text-gemini" />
          <span className="font-mono text-xs text-silver uppercase tracking-wider">
            Google AI Quota
          </span>
        </div>
        <div className="p-4">
          <p className="font-mono text-[10px] text-idle leading-relaxed">
            Set <code className="bg-steel/20 px-1 rounded">GOOGLE_PROJECT_ID</code> on the server to enable Google AI quota tracking.
          </p>
        </div>
      </div>
    )
  }

  // State: configured but error with no cached data
  if (error && !data) {
    return (
      <div className="bg-carbon/60 border border-steel/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-pending" />
          <span className="font-mono text-xs text-pending">Google AI quota unavailable</span>
        </div>
        <p className="font-mono text-[10px] text-idle">{error}</p>
      </div>
    )
  }

  // State: data (with or without error — error shown as cached indicator)
  if (!data) return null

  return (
    <div className="bg-carbon/60 border border-steel/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate/30 border-b border-steel/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-gemini" />
          <span className="font-mono text-xs text-silver uppercase tracking-wider">
            Google AI Quota
          </span>
        </div>
        <span className="font-mono text-[10px] text-gemini bg-gemini/10 px-1.5 py-0.5 rounded">
          Tier 1
        </span>
      </div>

      {/* Model sections */}
      <div className="p-4 space-y-4 divide-y divide-steel/20">
        {data.models.map((model, i) => (
          <div key={model.id} className={i > 0 ? 'pt-3' : ''}>
            <ModelSection model={model} />
          </div>
        ))}
      </div>

      {/* Footer */}
      {fetchedAt && (
        <div className="px-4 py-1.5 bg-slate/20 border-t border-steel/30">
          <span className="font-mono text-[10px] text-idle">
            Updated {new Date(fetchedAt).toLocaleTimeString('en-US', { hour12: false })}
          </span>
          {error && (
            <span className="font-mono text-[10px] text-pending ml-2">(cached)</span>
          )}
        </div>
      )}
    </div>
  )
}

export default GoogleAIUsage
