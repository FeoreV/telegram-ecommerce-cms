import { useEffect } from 'react'
import { useSocket } from '../contexts/SocketContext'

export const useStoresRealTime = (onUpdate: () => void) => {
  const { socket, connected } = useSocket()

  useEffect(() => {
    if (!socket || !connected) return

    // Listen for store updates
    socket.on('store:created', onUpdate)
    socket.on('store:updated', onUpdate)
    socket.on('store:deleted', onUpdate)

    return () => {
      socket.off('store:created', onUpdate)
      socket.off('store:updated', onUpdate)
      socket.off('store:deleted', onUpdate)
    }
  }, [socket, connected, onUpdate])
}

export default useStoresRealTime
