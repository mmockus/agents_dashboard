import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play, RefreshCw } from 'lucide-react'

const intervals = [
  { value: 0, label: 'Paused' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
]

function RefreshControl({ interval, onIntervalChange, lastRefresh, onManualRefresh }) {
  const isPaused = interval === 0
  const currentInterval = intervals.find(i => i.value === interval) || intervals[2]

  return (
    <div className="flex items-center gap-3">
      {/* Last refresh indicator */}
      {lastRefresh && (
        <div className="flex items-center gap-1.5 text-silver">
          <motion.div
            key={lastRefresh.getTime()}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-1.5 h-1.5 rounded-full bg-active"
          />
          <span className="font-mono text-xs">
            {lastRefresh.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      )}

      {/* Manual refresh button */}
      <button
        onClick={onManualRefresh}
        className="p-1.5 rounded-md bg-slate/30 border border-steel/30 hover:bg-slate/50 hover:border-steel transition-colors"
        title="Refresh now"
      >
        <RefreshCw className="w-3.5 h-3.5 text-silver" />
      </button>

      {/* Interval selector */}
      <div className="flex items-center gap-1 p-1 bg-slate/30 rounded-lg border border-steel/30">
        {intervals.map((opt) => {
          const isActive = interval === opt.value
          const Icon = opt.value === 0 ? Pause : null

          return (
            <button
              key={opt.value}
              onClick={() => onIntervalChange(opt.value)}
              className={`
                relative px-2 py-1 rounded-md font-mono text-xs transition-colors
                flex items-center gap-1
                ${isActive ? 'text-ice' : 'text-silver hover:text-ghost'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="refresh-bg"
                  className={`absolute inset-0 rounded-md ${opt.value === 0 ? 'bg-pending/20' : 'bg-active/20'}`}
                  transition={{ type: 'spring', duration: 0.3 }}
                />
              )}
              <span className="relative flex items-center gap-1">
                {Icon && <Icon className="w-3 h-3" />}
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Spinning indicator when active */}
      {!isPaused && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4"
        >
          <RefreshCw className="w-4 h-4 text-active/50" />
        </motion.div>
      )}
    </div>
  )
}

export default RefreshControl
