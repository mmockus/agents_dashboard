import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Clock, X } from 'lucide-react'

function RateLimitBanner({ rateLimit, onDismiss }) {
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    if (!rateLimit?.resetsAt) return

    const updateTime = () => {
      const now = Date.now()
      const resetTime = new Date(rateLimit.resetsAt).getTime()
      const diff = resetTime - now

      if (diff <= 0) {
        setTimeRemaining('Resetting...')
        // Auto-dismiss after reset
        setTimeout(() => onDismiss?.(), 2000)
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`)
      } else {
        setTimeRemaining(`${seconds}s`)
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [rateLimit?.resetsAt, onDismiss])

  if (!rateLimit?.isLimited) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-error/10 border-b border-error/30 px-6 py-3"
      >
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-error/20 border border-error/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-error" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-error">
                  Rate Limited
                </span>
                {rateLimit.provider && (
                  <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                    rateLimit.provider === 'claude' ? 'bg-claude/10 text-claude' : 'bg-gemini/10 text-gemini'
                  }`}>
                    {rateLimit.provider}
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-silver">
                {rateLimit.message || 'API rate limit reached'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-carbon/50 border border-steel/30">
              <Clock className="w-4 h-4 text-error" />
              <span className="font-mono text-sm text-error font-medium">
                {timeRemaining}
              </span>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-md hover:bg-steel/30 transition-colors"
              >
                <X className="w-4 h-4 text-silver" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default RateLimitBanner
