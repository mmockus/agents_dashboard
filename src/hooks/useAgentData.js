import { useState, useEffect, useCallback, useRef } from 'react'
import { telemetry } from '../api/telemetry'

// Mock data fallback when server is unavailable
const mockAgents = [
  {
    id: 'mock-demo-001',
    name: 'Demo Agent',
    provider: 'claude',
    type: 'assistant',
    status: 'idle',
    model: 'claude-sonnet-4',
    currentTask: 'Telemetry server not connected - showing demo data',
    tokensUsed: 0,
    tokensLimit: 100000,
    uptime: '0m',
    subAgents: []
  }
]

const mockActivities = [
  {
    id: 1,
    agent: 'System',
    action: 'Server offline',
    detail: 'Start the telemetry server: cd server && npm run dev',
    time: 'now',
    type: 'queue',
    provider: 'claude'
  }
]

export function useAgentData(refreshInterval = 5000) {
  const [agents, setAgents] = useState([])
  const [activities, setActivities] = useState([])
  const [rateLimit, setRateLimit] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [serverAvailable, setServerAvailable] = useState(false)
  const intervalRef = useRef(null)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    const available = await telemetry.isServerAvailable()
    setServerAvailable(available)

    if (available) {
      const [agentsData, activitiesData, rateLimitData, subscriptionData] = await Promise.all([
        telemetry.getAgents(),
        telemetry.getActivities(50),
        telemetry.getRateLimit(),
        telemetry.getSubscription()
      ])

      // Always replace agents list with server data (clears stale agents)
      setAgents(agentsData)
      setActivities(activitiesData.length > 0 ? activitiesData : mockActivities)
      setRateLimit(rateLimitData.isLimited ? rateLimitData : null)
      setSubscription(subscriptionData)
    } else {
      // Use mock data when server is unavailable
      setAgents(mockAgents)
      setActivities(mockActivities)
      setRateLimit(null)
    }

    setLastRefresh(new Date())
    setIsLoading(false)
  }, [])

  // Handle WebSocket messages
  const handleMessage = useCallback((message) => {
    switch (message.type) {
      case 'connected':
        setIsConnected(true)
        break

      case 'disconnected':
        setIsConnected(false)
        break

      case 'init':
        // Initial state from server - replace all data
        setAgents(message.data.agents || [])
        setActivities(message.data.activities?.length > 0 ? message.data.activities : mockActivities)
        if (message.data.subscription) {
          setSubscription(message.data.subscription)
        }
        setLastRefresh(new Date())
        break

      case 'agent:update':
      case 'agent:heartbeat':
        setAgents(prev => {
          const index = prev.findIndex(a => a.id === message.data.id)
          if (index >= 0) {
            const updated = [...prev]
            updated[index] = { ...updated[index], ...message.data }
            return updated
          }
          return [...prev, message.data]
        })
        setLastRefresh(new Date())
        break

      case 'agent:ended':
        setAgents(prev =>
          prev.map(a => a.id === message.data.id ? { ...a, status: 'complete' } : a)
        )
        break

      case 'agent:removed':
        setAgents(prev => prev.filter(a => a.id !== message.data.id))
        break

      case 'subagent:spawned':
        setAgents(prev =>
          prev.map(a => {
            if (a.id === message.data.parentId) {
              return {
                ...a,
                subAgents: [...(a.subAgents || []), message.data.subAgent]
              }
            }
            return a
          })
        )
        break

      case 'activity:new':
        setActivities(prev => [message.data, ...prev.slice(0, 49)])
        setLastRefresh(new Date())
        break

      case 'rate-limit':
        setRateLimit(message.data)
        break

      case 'rate-limit-cleared':
        setRateLimit(null)
        break

      case 'subscription:update':
        setSubscription(message.data)
        break

      default:
        break
    }
  }, [])

  // Setup WebSocket connection and polling
  useEffect(() => {
    // Initial fetch
    fetchData()

    // Connect WebSocket
    telemetry.connect()
    const unsubscribe = telemetry.subscribe(handleMessage)

    return () => {
      unsubscribe()
      telemetry.disconnect()
    }
  }, [fetchData, handleMessage])

  // Setup polling interval
  useEffect(() => {
    if (refreshInterval === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(fetchData, refreshInterval)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshInterval, fetchData])

  // Manual refresh
  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  return {
    agents,
    activities,
    rateLimit,
    subscription,
    isConnected,
    isLoading,
    lastRefresh,
    serverAvailable,
    refresh
  }
}
