// src/screens/chat/useChatSocket.ts

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CHAT_WS_URL, CHAT_WS_PATH } from '@/network';
import type { ChatMessage } from './chatTypes';
import { mapBackendToChatMessage } from './chatMapping';

type UseChatSocketParams = {
  authToken: string | null;
  roomId: string;
  currentUserId: string;
  replaceMessages: (messages: ChatMessage[]) => void;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
};

export const useChatSocket = ({
  authToken,
  roomId,
  currentUserId,
  replaceMessages,
  messagesRef,
}: UseChatSocketParams) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!authToken) {
      console.warn(
        '[ChatRoomPage] No auth token – socket connection disabled. User must be logged in.',
      );
      return;
    }

    const socket = io(CHAT_WS_URL, {
      path: CHAT_WS_PATH,
      transports: ['websocket'],
      extraHeaders: {
        Authorization: `Bearer ${authToken}`,
      },
      auth: {
        token: authToken,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Chat socket connected', socket.id);
      setIsConnected(true);

      // Join this room, then fetch history
      socket.emit(
        'chat.join',
        { conversationId: roomId },
        (resp: any) => {
          console.log('chat.join ack', resp);

          socket.emit(
            'chat.history',
            { conversationId: roomId, limit: 50 },
            (items: any[]) => {
              const mapped = items.map((m) =>
                mapBackendToChatMessage(m, currentUserId, roomId),
              );
              replaceMessages(mapped);
            },
          );
        },
      );
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Chat socket disconnected', reason);
      setIsConnected(false);
    });

    // Live messages from room
    socket.on('chat.message', (payload: any) => {
      const mapped = mapBackendToChatMessage(payload, currentUserId, roomId);
      const current = messagesRef.current;

      // De-dupe by id or clientId if needed
      if (current.some((m) => m.id === mapped.id)) {
        return;
      }

      replaceMessages([...current, mapped]);
    });

    // Typing events (wire to UI later if desired)
    socket.on('typing', (evt: any) => {
      console.log('typing event', evt);
    });

    return () => {
      try {
        socket.emit('chat.leave', { conversationId: roomId });
      } catch {}
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, roomId, currentUserId, replaceMessages, messagesRef]);

  return { isConnected, socketRef };
};
