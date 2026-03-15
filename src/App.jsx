import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Cpu,
  GitBranch,
  Terminal,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  ChevronRight,
  Sparkles,
  Wifi,
  WifiOff,
  Trash2
} from 'lucide-react'
import AgentCard from './components/AgentCard'
import ActivityFeed from './components/ActivityFeed'
import SubAgentTree from './components/SubAgentTree'
import StatusBar from './components/StatusBar'
import ProviderFilter from './components/ProviderFilter'
import RefreshControl from './components/RefreshControl'
import RateLimitBanner from './components/RateLimitBanner'
import SubscriptionUsage from './components/SubscriptionUsage'
import GoogleAIUsage from './components/GoogleAIUsage'
import { useAgentData } from './hooks/useAgentData'
import { telemetry } from './api/telemetry'

// Fallback mock data when server is unavailable
const fallbackAgents = [
  {
    id: 'demo-001',
    name: 'Demo Agent',
    provider: 'claude',
    type: 'assistant',
    status: 'idle',
    model: 'claude-sonnet-4',
    currentTask: 'Waiting for telemetry server connection...',
    uptime: '0m',
    subAgents: []
  }
]

const fallbackActivities = [
  {
    id: 1,
    agent: 'System',
    action: 'Server offline',
    detail: 'Run: cd server && npm install && npm run dev',
    time: 'now',
    type: 'queue',
    provider: 'claude'
  }
]

function App() {
  const [refreshInterval, setRefreshInterval] = useState(5000)

  // Use telemetry hook for real data
  const {
    agents: liveAgents,
    activities: liveActivities,
    rateLimit: liveRateLimit,
    subscription: liveSubscription,
    googleQuota: liveGoogleQuota,
    isConnected,
    serverAvailable,
    lastRefresh: liveLastRefresh,
    refresh: manualRefresh
  } = useAgentData(refreshInterval)

  const [selectedAgent, setSelectedAgent] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [providerFilter, setProviderFilter] = useState('all')

  // Use live data if available, otherwise fallback
  const agents = serverAvailable ? liveAgents : fallbackAgents
  const activities = serverAvailable ? liveActivities : fallbackActivities
  const lastRefresh = liveLastRefresh

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const STALE_AGENT_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

  const filteredAgents = agents
    .filter(a => {
      // Always hide agents explicitly marked as complete
      if (a.status === 'complete') {
        return false;
      }
      // Hide agents that haven't had a heartbeat in a while, unless they are waiting for user input
      const lastHeartbeat = a.lastHeartbeat || a.lastSeen
      if (a.status !== 'waiting' && lastHeartbeat) {
        const lastSeen = new Date(lastHeartbeat).getTime()
        if (Date.now() - lastSeen > STALE_AGENT_TIMEOUT_MS) {
          return false // It's stale
        }
      }
      return true;
    })
    .filter(a => providerFilter === 'all' || a.provider === providerFilter)

  const filteredActivities = providerFilter === 'all'
    ? activities
    : activities.filter(a => a.provider === providerFilter)

  const stats = {
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    pending: agents.filter(a => a.status === 'pending').length,
    error: agents.filter(a => a.status === 'error').length,
    totalSubAgents: agents.reduce((acc, a) => acc + (a.subAgents?.length || 0), 0),
    claudeCount: agents.filter(a => a.provider === 'claude').length,
    geminiCount: agents.filter(a => a.provider === 'gemini').length,
  }

  const clearAllAgents = async () => {
    if (!confirm('Clear all agents and history?')) return
    try {
      await fetch(`${import.meta.env.VITE_TELEMETRY_URL || 'http://localhost:3001'}/api/agents`, { method: 'DELETE' })
      manualRefresh()
    } catch (e) {
      console.error('Failed to clear agents', e)
    }
  }

  return (
    <div className="min-h-screen bg-void grid-bg relative">
      {/* Noise overlay for texture */}
      <div className="noise-overlay" />

      {/* Header */}
      <header className="border-b border-steel/50 bg-carbon/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-active/20 to-active/5 border border-active/30 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-active" />
                </div>
                <div>
                  <h1 className="font-mono text-lg font-semibold text-ice tracking-tight">
                    AGENTS DASHBOARD
                  </h1>
                  <p className="text-xs text-silver font-mono">Mission Control v0.4</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={clearAllAgents}
                className="p-2 rounded-lg bg-carbon border border-steel/30 text-silver hover:text-error hover:border-error/50 transition-colors"
                title="Clear all agents"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <RefreshControl
                interval={refreshInterval}
                onIntervalChange={setRefreshInterval}
                lastRefresh={lastRefresh}
                onManualRefresh={manualRefresh}
              />
              <StatusBar stats={stats} />
              <div className="text-right">
                <div className="font-mono text-sm text-ice">
                  {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                </div>
                <div className="font-mono text-xs text-silver">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Server connection banner */}
      {!serverAvailable && (
        <div className="bg-pending/10 border-b border-pending/30 px-6 py-2">
          <div className="max-w-[1800px] mx-auto flex items-center gap-3">
            <WifiOff className="w-4 h-4 text-pending" />
            <span className="font-mono text-xs text-pending">
              Telemetry server not connected. Start it with: <code className="bg-carbon px-1.5 py-0.5 rounded">cd server && npm install && npm run dev</code>
            </span>
          </div>
        </div>
      )}

      {/* Rate limit banner */}
      <RateLimitBanner
        rateLimit={liveRateLimit}
        onDismiss={() => telemetry.clearRateLimit()}
      />

      {/* Main content */}
      <main className="max-w-[1800px] mx-auto px-6 py-6 pb-16">
        <div className="grid grid-cols-12 gap-6">
          {/* Agent cards grid */}
          <div className="col-span-12 lg:col-span-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-silver" />
                <h2 className="font-mono text-sm text-silver uppercase tracking-wider">Active Agents</h2>
                <span className="font-mono text-xs text-active bg-active/10 px-2 py-0.5 rounded">
                  {filteredAgents.filter(a => a.status === 'active').length} running
                </span>
              </div>
              <ProviderFilter
                current={providerFilter}
                onChange={setProviderFilter}
                stats={stats}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredAgents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <AgentCard
                      agent={agent}
                      isSelected={selectedAgent?.id === agent.id}
                      onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
                      isPaused={refreshInterval === 0}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {filteredAgents.length === 0 && (
              <div className="text-center py-12">
                <Cpu className="w-12 h-12 text-steel mx-auto mb-4" />
                <p className="font-mono text-sm text-silver">No agents running</p>
                <p className="font-mono text-xs text-idle mt-1">
                  Start a Claude Code session to see agents appear here
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Subscription Usage */}
            <SubscriptionUsage subscription={liveSubscription} />

            {/* Google AI Quota Usage */}
            <GoogleAIUsage googleQuota={liveGoogleQuota} />

            {/* Activity Feed */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-silver" />
                <h2 className="font-mono text-sm text-silver uppercase tracking-wider">Activity Feed</h2>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-active status-pulse' : serverAvailable ? 'bg-pending' : 'bg-error'}`} />
              </div>
              <ActivityFeed activities={filteredActivities} />
            </div>

            {/* Sub-agent tree */}
            {selectedAgent && selectedAgent.subAgents?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="w-4 h-4 text-silver" />
                  <h2 className="font-mono text-sm text-silver uppercase tracking-wider">Sub-Agents</h2>
                </div>
                <SubAgentTree agent={selectedAgent} />
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Footer status line */}
      <footer className="fixed bottom-0 left-0 right-0 bg-carbon/90 backdrop-blur-sm border-t border-steel/30 py-2 px-6">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 font-mono text-xs text-silver">
            <span className="flex items-center gap-1.5">
              {serverAvailable ? (
                <>
                  <Wifi className="w-3 h-3 text-active" />
                  <span className="text-active">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-error" />
                  <span className="text-error">Offline</span>
                </>
              )}
            </span>
            <span>|</span>
            <span>{stats.totalSubAgents} sub-agents</span>
            <span>|</span>
            <span>
              {liveSubscription?.data?.five_hour
                ? `5h: ${Math.round(liveSubscription.data.five_hour.utilization)}%`
                : 'Usage: --'}
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="flex items-center gap-1.5 text-claude">
              <span className="w-1.5 h-1.5 rounded-full bg-claude" />
              Claude
            </span>
            <span className="flex items-center gap-1.5 text-gemini">
              <span className="w-1.5 h-1.5 rounded-full bg-gemini" />
              Gemini
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
