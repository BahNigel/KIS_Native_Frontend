import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
} from 'react';
import { View, Text, FlatList } from 'react-native';

import { chatRoomStyles as styles } from '../chatRoomStyles';
import type { ChatMessage } from '../ChatRoomPage';
import { InteractiveMessageRow } from './InteractiveMessageRow';

type MessageListProps = {
  messages: ChatMessage[];
  palette: any;
  isEmpty: boolean;

  onReplyToMessage?: (message: ChatMessage) => void;
  onEditMessage?: (message: ChatMessage) => void;
  onPressMessage?: (message: ChatMessage) => void;
  onLongPressMessage?: (message: ChatMessage) => void;

  // NEW: selection
  selectionMode?: boolean;
  selectedMessageIds?: string[];
  onStartSelection?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  palette,
  isEmpty,
  onReplyToMessage,
  onEditMessage,
  onPressMessage,
  onLongPressMessage,
  selectionMode = false,
  selectedMessageIds = [],
  onStartSelection,
  onToggleSelect,
}) => {
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const handleContentSizeChange = () => {
    if (!listRef.current) return;
    listRef.current.scrollToEnd({ animated: true });
  };

  const scrollToMessage = useCallback(
    (messageId: string) => {
      if (!listRef.current) return;
      const index = messages.findIndex((m) => m.id === messageId);
      if (index < 0) return;

      try {
        listRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        });
      } catch (e) {
        const approximateItemHeight = 72;
        listRef.current.scrollToOffset({
          offset: Math.max(0, index * approximateItemHeight),
          animated: true,
        });
      }
    },
    [messages],
  );

  const highlightMessage = useCallback((messageId: string) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedMessageId(messageId);

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 2000);
  }, []);

  const handlePressReplySource = useCallback(
    (messageId: string) => {
      scrollToMessage(messageId);
      highlightMessage(messageId);
    },
    [scrollToMessage, highlightMessage],
  );

  if (isEmpty) {
    return (
      <View style={styles.emptyStateContainer}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Select a chat to start messaging.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      style={styles.messagesList}
      contentContainerStyle={styles.messagesListContent}
      onContentSizeChange={handleContentSizeChange}
      onScrollToIndexFailed={(info) => {
        const approximateItemHeight = 72;
        listRef.current?.scrollToOffset({
          offset: Math.max(0, info.index * approximateItemHeight),
          animated: true,
        });
      }}
      renderItem={({ item, index }) => {
        const previous = messages[index - 1];
        const showTimestampHeader = shouldShowTimestampHeader(previous, item);

        const replySource =
          item.replyToId != null
            ? messages.find((m) => m.id === item.replyToId)
            : undefined;

        const isHighlighted = item.id === highlightedMessageId;
        const isSelected = selectedMessageIds.includes(item.id);

        return (
          <View>
            {showTimestampHeader && (
              <View style={styles.timestampHeaderContainer}>
                <Text
                  style={[
                    styles.timestampHeaderText,
                    {
                      backgroundColor:
                        palette.timestampBg ?? '#00000033',
                      color: palette.onTimestamp ?? '#fff',
                    },
                  ]}
                >
                  {formatDayLabel(item.createdAt)}
                </Text>
              </View>
            )}

            <InteractiveMessageRow
              message={item}
              palette={palette}
              replySource={replySource}
              isHighlighted={isHighlighted}
              isSelected={isSelected}
              selectionMode={selectionMode}
              onPressReplySource={handlePressReplySource}
              onReplyToMessage={onReplyToMessage}
              onEditMessage={onEditMessage}
              onPressMessage={onPressMessage}
              onLongPressMessage={onLongPressMessage}
              onStartSelection={onStartSelection}
              onToggleSelect={onToggleSelect}
            />
          </View>
        );
      }}
    />
  );
};

const shouldShowTimestampHeader = (
  prev: ChatMessage | undefined,
  current: ChatMessage,
) => {
  if (!prev) return true;
  const prevDate = new Date(prev.createdAt);
  const currDate = new Date(current.createdAt);

  const prevDay = prevDate.toDateString();
  const currDay = currDate.toDateString();

  return prevDay !== currDay;
};

const formatDayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toDateString();
};
