import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const providers = [
  { id: 'all', label: 'All', color: 'text-ghost' },
  { id: 'claude', label: 'Claude', color: 'text-claude' },
  { id: 'gemini', label: 'Gemini', color: 'text-gemini' },
]

function ProviderFilter({ current, onChange, stats }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate/30 rounded-lg border border-steel/30">
      {providers.map((provider) => {
        const isActive = current === provider.id
        const count = provider.id === 'all'
          ? stats.total
          : provider.id === 'claude'
            ? stats.claudeCount
            : stats.geminiCount

        return (
          <button
            key={provider.id}
            onClick={() => onChange(provider.id)}
            className={`
              relative px-3 py-1.5 rounded-md font-mono text-xs transition-colors
              flex items-center gap-2
              ${isActive ? 'text-ice' : 'text-silver hover:text-ghost'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="provider-bg"
                className="absolute inset-0 bg-steel/50 rounded-md"
                transition={{ type: 'spring', duration: 0.3 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {provider.id === 'claude' && (
                <span className="w-2 h-2 rounded-full bg-claude" />
              )}
              {provider.id === 'gemini' && (
                <Sparkles className="w-3 h-3 text-gemini" />
              )}
              {provider.label}
              <span className={`text-[10px] ${isActive ? 'text-silver' : 'text-idle'}`}>
                {count}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ProviderFilter
