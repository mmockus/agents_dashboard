import { motion } from 'framer-motion'
import { Cpu, GitBranch, Clock, Pause, CheckCircle, XCircle, HelpCircle } from 'lucide-react'

// Helper to get status-specific styles
const getStatusStyles = (status) => {
  switch (status) {
    case 'active': return { icon: <Cpu />, color: 'active', pulse: true };
    case 'waiting': return { icon: <HelpCircle />, color: 'waiting', pulse: true };
    case 'complete': return { icon: <CheckCircle />, color: 'complete', pulse: false };
    case 'error': return { icon: <XCircle />, color: 'error', pulse: false };
    case 'idle':
    default: return { icon: <Pause />, color: 'idle', pulse: false };
  }
};

const AgentCard = ({ agent, isSelected, onClick, isPaused }) => {
  const { id, name, provider, status, model, currentTask, uptime, subAgents } = agent;
  const statusInfo = getStatusStyles(status);

  const providerColors = {
    claude: 'border-claude',
    gemini: 'border-gemini',
    default: 'border-steel'
  };

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-lg bg-carbon border transition-all duration-300 cursor-pointer
        ${isSelected ? 'border-active shadow-lg shadow-active/10' : 'border-steel/30 hover:border-steel'}
        ${providerColors[provider] || providerColors.default} border-l-4
      `}
    >
      {/* Status Strip */}
      <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden rounded-t-md">
        {status === 'active' && !isPaused && (
          <motion.div
            className="h-full bg-active"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between">
          {/* Icon Container */}
          <div className={`
            relative w-10 h-10 rounded-lg bg-carbon border border-steel/30 flex items-center justify-center
            ${status === 'waiting' && 'glow-waiting'}
          `}>
            <div className={`text-${statusInfo.color}`}>
              {statusInfo.icon}
            </div>
            {statusInfo.pulse && !isPaused && <div className={`absolute inset-0 rounded-lg status-pulse bg-${statusInfo.color}`} />}
          </div>

          {/* Model Badge */}
          <div className="text-right">
            <span className="inline-block bg-steel/20 text-silver text-[10px] font-mono px-1.5 py-0.5 rounded">
              {model}
            </span>
          </div>
        </div>

        {/* Agent Name */}
        <h3 className="font-mono text-base font-semibold text-ice mt-3 truncate" title={name}>
          {name}
        </h3>

        {/* Current Task */}
        <p className="font-mono text-xs text-silver h-8 mt-1 line-clamp-2" title={currentTask}>
          {currentTask}
          {status === 'active' && !isPaused && <span className="cursor-blink">|</span>}
        </p>

        {/* Footer Stats */}
        <div className="border-t border-steel/20 mt-4 pt-3 flex items-center justify-between font-mono text-xs text-idle">
          <div className="flex items-center gap-1.5" title="Uptime">
            <Clock className="w-3 h-3" />
            <span>{uptime || '0s'}</span>
          </div>
          {subAgents?.length > 0 && (
            <div className="flex items-center gap-1.5" title="Sub-agents">
              <GitBranch className="w-3 h-3" />
              <span>{subAgents.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
