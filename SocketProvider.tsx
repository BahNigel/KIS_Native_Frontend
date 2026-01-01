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
import { CHAT_WS_URL, CHAT_WS_PATH } from '@/network';
import { getCache } from '@/network/cache';

/* ============================================================================
 * TYPES
 * ============================================================================
 */

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  currentUserId?: string | null;
  typingByConversation?: Record<string, Record<string, number>>;
  presenceByUser?: Record<string, { isOnline: boolean; at: number }>;
};

/* ============================================================================
 * CONTEXT
 * ============================================================================
 */

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  currentUserId: null,
  typingByConversation: {},
  presenceByUser: {},
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
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [typingByConversation, setTypingByConversation] =
    useState<Record<string, Record<string, number>>>({});
  const [presenceByUser, setPresenceByUser] =
    useState<Record<string, { isOnline: boolean; at: number }>>({});

  /**
   * --------------------------------------------------------------------------
   * REFS (INTERNAL ONLY)
   * --------------------------------------------------------------------------
   */

  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef<boolean>(true);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /**
   * --------------------------------------------------------------------------
   * CONNECT / DISCONNECT
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      let token =
        await AsyncStorage.getItem(
          'access_token',
        );
      const cached = await getCache(
        'AUTH_CACHE',
        'USER_KEY',
      );
      if (!token) {
        token =
          cached?.access ||
          cached?.access_token ||
          null;
      }
      const uid =
        cached?.user?.id ||
        cached?.user?.pk ||
        null;
      if (uid) setCurrentUserId(String(uid));
      const deviceIdKey = 'device_id';
      let deviceId =
        await AsyncStorage.getItem(deviceIdKey);
      if (!deviceId) {
        deviceId = `dev_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`;
        await AsyncStorage.setItem(
          deviceIdKey,
          deviceId,
        );
      }

      if (!mountedRef.current) return;
      if (!isAuth || !token) return;

      // Prevent duplicate connections
      if (socketRef.current) return;

      const s = io(CHAT_WS_URL, {
        path: CHAT_WS_PATH,
        transports: ['websocket'],
        auth: { token, deviceId },
        extraHeaders: {
          Authorization: `Bearer ${token}`,
          'x-device-id': deviceId,
        },
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

      s.on('chat.typing', (payload: any) => {
        const convId = payload?.conversationId;
        const userId = payload?.userId;
        const isTyping = payload?.isTyping;
        if (!convId || !userId) return;

        setTypingByConversation((prev) => {
          const next = { ...prev };
          const conv = { ...(next[convId] ?? {}) };
          if (isTyping) {
            conv[userId] = Date.now();
            next[convId] = conv;
          } else {
            delete conv[userId];
            if (Object.keys(conv).length) next[convId] = conv;
            else delete next[convId];
          }
          return next;
        });

        const key = `${convId}:${userId}`;
        if (isTyping) {
          if (typingTimeoutsRef.current[key]) {
            clearTimeout(typingTimeoutsRef.current[key]);
          }
          typingTimeoutsRef.current[key] = setTimeout(() => {
            setTypingByConversation((prev) => {
              const next = { ...prev };
              const conv = { ...(next[convId] ?? {}) };
              delete conv[userId];
              if (Object.keys(conv).length) next[convId] = conv;
              else delete next[convId];
              return next;
            });
            delete typingTimeoutsRef.current[key];
          }, 5000);
        }
      });

      s.on('chat.presence', (payload: any) => {
        const userId = payload?.userId;
        if (!userId) return;
        const isOnline = !!payload?.isOnline;
        const at = payload?.at
          ? Date.parse(payload.at)
          : Date.now();
        setPresenceByUser((prev) => ({
          ...prev,
          [userId]: { isOnline, at },
        }));
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
      Object.values(typingTimeoutsRef.current).forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current = {};

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
      currentUserId,
      typingByConversation,
      presenceByUser,
    }),
    [socket, isConnected, currentUserId, typingByConversation, presenceByUser],
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
