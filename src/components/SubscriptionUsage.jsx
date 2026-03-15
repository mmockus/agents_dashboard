import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

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

  // Format the actual reset time
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

  let countdown
  if (days > 0) {
    countdown = `${days}d ${hours}h`
  } else if (hours > 0) {
    countdown = `${hours}h ${minutes}m`
  } else {
    countdown = `${minutes}m`
  }

  return { countdown, resetTime }
}

function UsageBar({ label, utilization, resetsAt, icon: IconComponent }) {
  const pct = Math.round(utilization || 0)
  const colors = getUtilizationColor(pct)
  const [timeInfo, setTimeInfo] = useState(formatCountdown(resetsAt))
  const isLimited = pct >= 100

  useEffect(() => {
    if (!resetsAt) return
    const timer = setInterval(() => setTimeInfo(formatCountdown(resetsAt)), 60000)
    setTimeInfo(formatCountdown(resetsAt))
    return () => clearInterval(timer)
  }, [resetsAt])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IconComponent className={`w-3 h-3 ${colors.text}`} />
          <span className="font-mono text-xs text-silver">{label}</span>
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
      {/* Show reset time - always visible, highlighted when rate limited */}
      {timeInfo.resetTime && (
        <div className={`font-mono text-[10px] ${isLimited ? 'text-error' : 'text-idle'}`}>
          {isLimited ? 'Unlocks: ' : 'Resets: '}{timeInfo.resetTime}
        </div>
      )}
    </div>
  )
}

function SubscriptionUsage({ subscription }) {
  if (!subscription) return null

  const { data, error, subscriptionType, fetchedAt } = subscription

  if (error && !data) {
    return (
      <div className="bg-carbon/60 border border-steel/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-pending" />
          <span className="font-mono text-xs text-pending">Subscription data unavailable</span>
        </div>
        <p className="font-mono text-[10px] text-idle">{error}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-carbon/60 border border-steel/50 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate/30 border-b border-steel/30">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-claude" />
          <span className="font-mono text-xs text-silver uppercase tracking-wider">
            Subscription Usage
          </span>
        </div>
        {subscriptionType && (
          <span className="font-mono text-[10px] text-claude bg-claude/10 px-1.5 py-0.5 rounded">
            {subscriptionType}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {data.five_hour && (
          <UsageBar
            label="5-Hour Window"
            utilization={data.five_hour.utilization}
            resetsAt={data.five_hour.resets_at}
            icon={Zap}
          />
        )}
        {data.seven_day && (
          <UsageBar
            label="7-Day Window"
            utilization={data.seven_day.utilization}
            resetsAt={data.seven_day.resets_at}
            icon={TrendingUp}
          />
        )}
        {data.seven_day_opus && (
          <UsageBar
            label="7-Day Opus"
            utilization={data.seven_day_opus.utilization}
            resetsAt={data.seven_day_opus.resets_at}
            icon={TrendingUp}
          />
        )}
      </div>

      {fetchedAt && (
        <div className="px-4 py-1.5 bg-slate/20 border-t border-steel/30">
          <span className="font-mono text-[10px] text-idle">
            Updated {new Date(fetchedAt).toLocaleTimeString('en-US', { hour12: false })}
          </span>
          {error && (
            <span className="font-mono text-[10px] text-pending ml-2">(using cached data)</span>
          )}
        </div>
      )}
    </div>
  )
}

export default SubscriptionUsage
