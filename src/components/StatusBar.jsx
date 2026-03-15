import { Cpu, Play, Pause, AlertTriangle } from 'lucide-react'

function StatusBar({ stats }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate/50 border border-steel/30">
        <Cpu className="w-4 h-4 text-silver" />
        <span className="font-mono text-sm text-ghost">{stats.total}</span>
        <span className="font-mono text-xs text-silver">agents</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-active status-pulse" />
          <span className="font-mono text-sm text-active">{stats.active}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-pending" />
          <span className="font-mono text-sm text-pending">{stats.pending}</span>
        </div>
        {stats.error > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-error status-pulse" />
            <span className="font-mono text-sm text-error">{stats.error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default StatusBar
