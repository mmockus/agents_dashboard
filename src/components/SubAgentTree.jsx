import { motion } from 'framer-motion'
import { GitBranch, CircleDot } from 'lucide-react'

const statusColors = {
  active: 'bg-active text-active border-active/30',
  pending: 'bg-pending text-pending border-pending/30',
  error: 'bg-error text-error border-error/30',
  idle: 'bg-idle text-idle border-idle/30',
}

function SubAgentTree({ agent }) {
  return (
    <div className="bg-carbon/60 border border-steel/50 rounded-lg overflow-hidden">
      {/* Parent agent header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate/30 border-b border-steel/30">
        <div className="w-8 h-8 rounded-lg bg-complete/10 border border-complete/30 flex items-center justify-center">
          <GitBranch className="w-4 h-4 text-complete" />
        </div>
        <div>
          <h4 className="font-mono text-sm font-medium text-ice">{agent.name}</h4>
          <p className="font-mono text-xs text-silver">{agent.subAgents.length} children</p>
        </div>
      </div>

      {/* Sub-agents list */}
      <div className="p-3">
        <div className="relative">
          {/* Vertical connection line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-steel/30" />

          {agent.subAgents.map((sub, index) => {
            const statusClass = statusColors[sub.status] || statusColors.idle
            const [bgColor] = statusClass.split(' ')

            return (
              <motion.div
                key={sub.id}
                className="relative flex items-start gap-3 py-2 pl-8"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Horizontal branch line */}
                <div className="absolute left-4 top-4 w-4 h-px bg-steel/30" />

                {/* Status dot */}
                <div className={`absolute left-[13px] top-[13px] w-2 h-2 rounded-full ${bgColor} ${sub.status === 'active' ? 'status-pulse' : ''}`} />

                {/* Content */}
                <div className="flex-1 bg-slate/20 rounded-md p-3 border border-steel/20 hover:border-steel/40 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-medium text-ghost">
                      {sub.name}
                    </span>
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${statusClass.replace(statusClass.split(' ')[0], statusClass.split(' ')[0] + '/10')}`}>
                      {sub.status}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-silver">
                    {sub.task}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SubAgentTree
