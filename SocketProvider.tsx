// SocketProvider.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './App';
import { WEBSOCKET_URL } from '@/network';

/* ============================================================================
 * TYPES
 * ============================================================================
 */

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
};

/* ============================================================================
 * CONTEXT
 * ============================================================================
 */

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

/* ============================================================================
 * PROVIDER
 * ============================================================================
 */

export const SocketProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { isAuth } = useAuth();

  /**
   * --------------------------------------------------------------------------
   * STATE (THIS IS THE IMPORTANT PART)
   * --------------------------------------------------------------------------
   */

  const [socket, setSocket] = useState<Socket | null>(
    null,
  );
  const [isConnected, setIsConnected] =
    useState<boolean>(false);

  /**
   * --------------------------------------------------------------------------
   * REFS (INTERNAL ONLY)
   * --------------------------------------------------------------------------
   */

  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef<boolean>(true);

  /**
   * --------------------------------------------------------------------------
   * CONNECT / DISCONNECT
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      const token =
        await AsyncStorage.getItem(
          'access_token',
        );

      if (!mountedRef.current) return;
      if (!isAuth || !token) return;

      // Prevent duplicate connections
      if (socketRef.current) return;

      const s = io(WEBSOCKET_URL, {
        path: '/ws',
        transports: ['websocket'],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current = s;
      setSocket(s); // 🔥 THIS IS THE KEY FIX

      s.on('connect', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        console.log('[WS] connected', s.id);
      });

      s.on('disconnect', (reason) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        console.log('[WS] disconnected', reason);
      });

      s.on('connect_error', (err) => {
        console.warn(
          '[WS] connect_error',
          err?.message,
        );
      });
    };

    connect();

    return () => {
      mountedRef.current = false;

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuth]);

  /**
   * --------------------------------------------------------------------------
   * CONTEXT VALUE (MEMOIZED)
   * --------------------------------------------------------------------------
   */

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      isConnected,
    }),
    [socket, isConnected],
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
