import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { SubscriptionPoller } from './subscriptionPoller.js'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

app.use(cors())
app.use(express.json())

// In-memory store for agents and activities
const agents = new Map()
const activities = []
const MAX_ACTIVITIES = 100

// Broadcast to all connected WebSocket clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() })
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message)
    }
  })
}

// Subscription usage poller
const subscriptionPoller = new SubscriptionPoller(broadcast)
subscriptionPoller.start()

// Format relative time
function formatRelativeTime(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

// Cleanup old agents (older than 15 minutes)
function cleanupOldAgents() {
  const fifteenMinAgo = Date.now() - 15 * 60 * 1000
  for (const [id, agent] of agents.entries()) {
    const lastSeen = agent.lastHeartbeat || agent.lastSeen || agent.startedAt || agent.endedAt
    const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : null
    const isStale = lastSeenTime !== null && lastSeenTime < fifteenMinAgo
    const isRemovable = agent.status === 'complete' || (agent.status !== 'waiting' && isStale)

    if (isRemovable) {
      agents.delete(id)
      broadcast('agent:removed', { id })
    }
  }
}

function inferProviderFromId(id) {
  if (id.startsWith('claude-')) return 'claude'
  if (id.startsWith('gemini-')) return 'gemini'
  if (id.startsWith('antigravity-')) return 'antigravity'
  return 'unknown'
}

function buildFallbackAgent(id, payload) {
  const now = new Date().toISOString()
  const provider = payload.provider || inferProviderFromId(id)
  const providerLabel = provider === 'unknown' ? 'Agent' : provider.charAt(0).toUpperCase() + provider.slice(1)
  return {
    id,
    name: payload.name || `${providerLabel}: ${id}`,
    provider,
    type: payload.type || 'assistant',
    status: payload.status || 'active',
    model: payload.model || 'unknown',
    currentTask: payload.currentTask || 'Session resumed',
    startedAt: now,
    lastSeen: now,
    lastHeartbeat: now,
    sessionId: payload.sessionId,
    subAgents: payload.subAgents || []
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldAgents, 10 * 60 * 1000)

// GET all agents
app.get('/api/agents', (req, res) => {
  // Clean up old agents on each request
  cleanupOldAgents()
  const agentList = Array.from(agents.values()).map(agent => ({
    ...agent,
    uptime: formatRelativeTime(agent.startedAt)
  }))
  res.json(agentList)
})

// DELETE all agents (clear dashboard) - must be before :id route
app.delete('/api/agents', (req, res) => {
  agents.clear()
  activities.length = 0
  broadcast('init', { agents: [], activities: [] })
  res.json({ ok: true, message: 'All agents and activities cleared' })
})

// GET single agent
app.get('/api/agents/:id', (req, res) => {
  const agent = agents.get(req.params.id)
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }
  res.json({ ...agent, uptime: formatRelativeTime(agent.startedAt) })
})

// POST register/update agent
app.post('/api/agents/:id', (req, res) => {
  const { id } = req.params
  let existingAgent = agents.get(id)

  if (!existingAgent && req.body.sessionId) {
    for (const [existingId, agent] of agents.entries()) {
      if (agent.sessionId === req.body.sessionId) {
        existingAgent = agent
        agents.delete(existingId)
        break
      }
    }
  }

  const agent = {
    id,
    startedAt: existingAgent?.startedAt || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    ...existingAgent,
    ...req.body,
    subAgents: req.body.subAgents || existingAgent?.subAgents || []
  }

  agents.set(id, agent)
  broadcast('agent:update', agent)
  res.json(agent)
})

// POST agent heartbeat (lightweight status update)
app.post('/api/agents/:id/heartbeat', (req, res) => {
  let agent = agents.get(req.params.id)
  if (!agent) {
    agent = buildFallbackAgent(req.params.id, req.body || {})
  }

  const heartbeatAt = new Date().toISOString()
  agent.lastSeen = heartbeatAt
  agent.lastHeartbeat = heartbeatAt
  agent.name = req.body.name ?? agent.name
  agent.provider = req.body.provider ?? agent.provider
  agent.model = req.body.model ?? agent.model
  agent.tokensUsed = req.body.tokensUsed ?? agent.tokensUsed
  agent.status = req.body.status ?? agent.status
  agent.currentTask = req.body.currentTask ?? agent.currentTask
  if (agent.status === 'complete' && !agent.endedAt) {
    agent.endedAt = new Date().toISOString()
  }

  agents.set(req.params.id, agent)
  broadcast('agent:heartbeat', agent)
  res.json({ ok: true })
})

// DELETE agent (session ended)
app.delete('/api/agents/:id', (req, res) => {
  const agent = agents.get(req.params.id)
  if (agent) {
    agent.status = 'complete'
    agent.endedAt = new Date().toISOString()
    broadcast('agent:ended', agent)
    // Keep agent in list but mark as complete instead of removing
    agents.set(req.params.id, agent)
  }
  res.json({ ok: true })
})

// POST add sub-agent
app.post('/api/agents/:id/subagents', (req, res) => {
  const agent = agents.get(req.params.id)
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }

  const subAgent = {
    id: req.body.id || `sub-${Date.now()}`,
    ...req.body,
    startedAt: new Date().toISOString()
  }

  agent.subAgents = agent.subAgents || []
  agent.subAgents.push(subAgent)
  agents.set(req.params.id, agent)

  broadcast('subagent:spawned', { parentId: req.params.id, subAgent })
  res.json(subAgent)
})

// Rate limit tracking
let currentRateLimit = null

// POST report rate limit
app.post('/api/rate-limit', (req, res) => {
  const { provider, resetsAt, message } = req.body

  currentRateLimit = {
    isLimited: true,
    provider: provider || 'unknown',
    resetsAt: resetsAt || new Date(Date.now() + 60000).toISOString(), // Default 1 min
    message: message || 'API rate limit reached',
    reportedAt: new Date().toISOString()
  }

  broadcast('rate-limit', currentRateLimit)

  // Auto-clear after reset time
  const resetTime = new Date(currentRateLimit.resetsAt).getTime()
  const now = Date.now()
  if (resetTime > now) {
    setTimeout(() => {
      if (currentRateLimit?.resetsAt === resetsAt) {
        currentRateLimit = null
        broadcast('rate-limit-cleared', {})
      }
    }, resetTime - now + 1000)
  }

  res.json(currentRateLimit)
})

// DELETE clear rate limit
app.delete('/api/rate-limit', (req, res) => {
  currentRateLimit = null
  broadcast('rate-limit-cleared', {})
  res.json({ ok: true })
})

// GET current rate limit
app.get('/api/rate-limit', (req, res) => {
  res.json(currentRateLimit || { isLimited: false })
})

// GET all activities
app.get('/api/activities', (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const provider = req.query.provider

  let result = activities.slice(0, limit)
  if (provider && provider !== 'all') {
    result = result.filter(a => a.provider === provider)
  }

  // Update relative times
  result = result.map(a => ({
    ...a,
    time: formatRelativeTime(a.timestamp)
  }))

  res.json(result)
})

// POST add activity
app.post('/api/activities', (req, res) => {
  const activity = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    ...req.body
  }

  activities.unshift(activity)
  if (activities.length > MAX_ACTIVITIES) {
    activities.pop()
  }

  broadcast('activity:new', { ...activity, time: 'just now' })
  res.json(activity)
})

// GET subscription usage
app.get('/api/subscription', (req, res) => {
  res.json(subscriptionPoller.getUsage())
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    agents: agents.size,
    activities: activities.length,
    uptime: process.uptime()
  })
})

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Dashboard connected via WebSocket')

  // Send current state on connect
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      agents: Array.from(agents.values()),
      activities: activities.slice(0, 50),
      subscription: subscriptionPoller.getUsage()
    }
  }))

  ws.on('close', () => {
    console.log('Dashboard disconnected')
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           AGENTS TELEMETRY SERVER                        ║
╠═══════════════════════════════════════════════════════════╣
║  REST API:    http://localhost:${PORT}/api                   ║
║  WebSocket:   ws://localhost:${PORT}                         ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET  /api/agents          - List all agents            ║
║    POST /api/agents/:id      - Register/update agent      ║
║    POST /api/agents/:id/heartbeat - Status heartbeat      ║
║    DELETE /api/agents/:id    - End agent session          ║
║    GET  /api/activities      - List activities            ║
║    POST /api/activities      - Log activity               ║
║    GET  /api/subscription    - Claude subscription usage  ║
║    GET  /api/health          - Health check               ║
╚═══════════════════════════════════════════════════════════╝
  `)
})
