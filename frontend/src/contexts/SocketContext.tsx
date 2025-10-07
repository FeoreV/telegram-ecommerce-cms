import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

import { useAuth } from './AuthContext'
import { tokenManager } from '../services/apiClient'
import { toast } from 'react-toastify'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface SocketContextValue {
  socket: Socket | null
  connected: boolean
  isConnected: boolean
  status: ConnectionState
  connectionError: string | null
  connectionAttempts: number
  lastConnectedAt: number | null
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
  reconnect: () => void
  on: (event: string, callback: (...args: any[]) => void) => void
  off: (event: string, callback: (...args: any[]) => void) => void
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined)

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: React.ReactNode
}

const getInitialFlag = (key: string, fallback: boolean) => {
  const stored = localStorage.getItem(key)
  if (stored === null) {
    return fallback
  }
  return stored !== 'false'
}

const SOCKET_OPTIONS = {
  transports: ['websocket', 'polling'] as unknown as string[],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  forceNew: true,
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionState>('connecting')
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => getInitialFlag('notification_sound', true))
  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    getInitialFlag('notifications_enabled', true)
  )
  const cleanupRef = useRef<(() => void) | null>(null)
  const reconnectRef = useRef<() => void>(() => {})

  const socketUrl = useMemo(() => {
    const raw = (import.meta as any).env?.VITE_SOCKET_URL
    const fallback = (import.meta as any).env?.VITE_API_URL ?? 'http://82.147.84.78:3001'
    const normalized = String(raw ?? fallback).replace(/\/$/, '')
    return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized
  }, [])

  useEffect(() => {
    localStorage.setItem('notification_sound', soundEnabled ? 'true' : 'false')
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem('notifications_enabled', notificationsEnabled ? 'true' : 'false')
  }, [notificationsEnabled])

  const teardownSocket = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setSocket(null)
    setConnected(false)
    setConnectionError(null)
    setStatus('disconnected')
  }, [])

  useEffect(() => {
    const token = tokenManager.getAccessToken()
    if (!user || !token) {
      teardownSocket()
      return undefined
    }

    const instance = io(socketUrl, {
      ...SOCKET_OPTIONS,
      auth: { token },
    })

    const handleConnect = () => {
      setConnected(true)
      setConnectionError(null)
       setStatus('connected')
       setConnectionAttempts(0)
       setLastConnectedAt(Date.now())
    }

    const handleDisconnect = (reason: string) => {
      setConnected(false)
      setStatus(reason === 'io client disconnect' ? 'disconnected' : 'connecting')
    }

    const handleError = (error: Error) => {
      setConnectionError(error.message)
      setStatus('error')
      toast.error('Потеряно соединение с сервером. Автоподключение…')
    }

    const handleReconnectAttempt = (attempt: number) => {
      setConnectionAttempts(attempt)
      setStatus('connecting')
    }

    const handleReconnectFailed = () => {
      setStatus('error')
      toast.error('Не удалось восстановить соединение. Попробуйте позже.')
    }

    instance.on('connect', handleConnect)
    instance.on('disconnect', handleDisconnect)
    instance.on('connect_error', handleError)
    instance.on('error', handleError)
    instance.io.on('reconnect_attempt', handleReconnectAttempt)
    instance.io.on('reconnect_failed', handleReconnectFailed)

    setSocket(instance)

    cleanupRef.current = () => {
      instance.off('connect', handleConnect)
      instance.off('disconnect', handleDisconnect)
      instance.off('connect_error', handleError)
      instance.off('error', handleError)
      instance.io.off('reconnect_attempt', handleReconnectAttempt)
      instance.io.off('reconnect_failed', handleReconnectFailed)
      instance.disconnect()
    }

    return () => {
      teardownSocket()
    }
  }, [socketUrl, teardownSocket, user])

  reconnectRef.current = () => {
    if (socket && socket.disconnected) {
      setStatus('connecting')
      socket.connect()
    }
  }

  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      socket?.on(event, callback)
    },
    [socket]
  )

  const off = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      socket?.off(event, callback)
    },
    [socket]
  )

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      connected,
      isConnected: connected,
      status,
      connectionError,
      connectionAttempts,
      lastConnectedAt,
      soundEnabled,
      setSoundEnabled,
      notificationsEnabled,
      setNotificationsEnabled,
      reconnect: () => reconnectRef.current(),
      on,
      off,
    }),
    [connected, connectionAttempts, connectionError, lastConnectedAt, notificationsEnabled, off, on, socket, soundEnabled, status]
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export default SocketContext