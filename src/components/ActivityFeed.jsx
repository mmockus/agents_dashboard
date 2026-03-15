import { motion } from 'framer-motion'
import {
  GitBranch,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Send,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react'

const typeConfig = {
  spawn: {
    icon: GitBranch,
    color: 'text-complete',
    bg: 'bg-complete/10',
  },
  edit: {
    icon: FileEdit,
    color: 'text-pending',
    bg: 'bg-pending/10',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-active',
    bg: 'bg-active/10',
  },
  error: {
    icon: AlertCircle,
    color: 'text-error',
    bg: 'bg-error/10',
  },
  complete: {
    icon: CheckCircle2,
    color: 'text-active',
    bg: 'bg-active/10',
  },
  delegate: {
    icon: Send,
    color: 'text-complete',
    bg: 'bg-complete/10',
  },
  queue: {
    icon: Clock,
    color: 'text-silver',
    bg: 'bg-silver/10',
  },
}

const providerConfig = {
  claude: {
    color: 'text-claude',
    bg: 'bg-claude',
  },
  gemini: {
    color: 'text-gemini',
    bg: 'bg-gemini',
    icon: Sparkles,
  },
}

function ActivityFeed({ activities }) {
  return (
    <div className="bg-carbon/60 border border-steel/50 rounded-lg overflow-hidden">
      {/* Terminal-style header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate/30 border-b border-steel/30">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-error/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-pending/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-active/60" />
        </div>
        <span className="font-mono text-xs text-silver ml-2">activity.log</span>
      </div>

      {/* Activity list */}
      <div className="max-h-[400px] overflow-y-auto p-2">
        {activities.map((activity, index) => {
          const config = typeConfig[activity.type] || typeConfig.queue
          const provider = providerConfig[activity.provider] || providerConfig.claude
          const Icon = config.icon
          const ProviderIcon = provider.icon

          return (
            <motion.div
              key={activity.id}
              className="activity-item flex items-start gap-3 p-2 rounded-md hover:bg-slate/30 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {/* Icon with provider indicator */}
              <div className="relative flex-shrink-0 mt-0.5">
                <div className={`w-7 h-7 rounded-md ${config.bg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
                {/* Provider dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${provider.bg} border-2 border-carbon flex items-center justify-center`}>
                  {ProviderIcon && <ProviderIcon className="w-1.5 h-1.5 text-white" />}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-mono text-xs font-medium truncate ${provider.color}`}>
                    {activity.agent}
                  </span>
                  <span className="font-mono text-xs text-steel">→</span>
                  <span className={`font-mono text-xs ${config.color}`}>
                    {activity.action}
                  </span>
                </div>
                <p className="font-mono text-xs text-silver truncate">
                  {activity.detail}
                </p>
              </div>

              <span className="font-mono text-xs text-idle flex-shrink-0">
                {activity.time}
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* Footer with live indicator */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate/20 border-t border-steel/30">
        <div className="w-1.5 h-1.5 rounded-full bg-active status-pulse" />
        <span className="font-mono text-xs text-silver">Live updates</span>
      </div>
    </div>
  )
}

export default ActivityFeed
