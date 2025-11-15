// src/screens/chat/components/MessageBubble.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';

import { chatRoomStyles as styles } from '../chatRoomStyles';
import type { ChatMessage } from '../ChatRoomPage';

import AudioRecorderPlayer, {
  PlayBackType,
} from 'react-native-audio-recorder-player';
import { KISIcon } from '@/constants/kisIcons';

// Use a shared player instance for all bubbles
const audioPlayer = new AudioRecorderPlayer();

type MessageBubbleProps = {
  message: ChatMessage;
  palette: any;

  // reply preview
  replySource?: ChatMessage;
  onPressReplySource?: () => void;

  // highlight when scrolled-to from reply
  isHighlighted?: boolean;

  // NEW: selection visual
  isSelected?: boolean;
};

const formatTimeFromMs = (ms: number) => {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  palette,
  replySource,
  onPressReplySource,
  isHighlighted,
  isSelected = false,
}) => {
  const date = new Date(message.createdAt);
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isMe = message.fromMe;
  const voice = message.voice;
  const styled = message.styledText;
  const sticker = message.sticker;

  const isVoiceOnly = !!voice && !message.text && !styled && !sticker;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    return () => {
      try {
        audioPlayer.stopPlayer();
        audioPlayer.removePlayBackListener();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const stopPlayback = async () => {
    try {
      await audioPlayer.stopPlayer();
      audioPlayer.removePlayBackListener();
    } catch (e) {
      // ignore
    }
    setIsPlaying(false);
    setProgress(0);
  };

  const startPlayback = async () => {
    if (!voice) return;
    try {
      setIsPlaying(true);
      setProgress(0);

      await audioPlayer.startPlayer(voice.uri);

      audioPlayer.addPlayBackListener((e: PlayBackType) => {
        const pos = e.currentPosition ?? 0;
        const dur =
          e.duration ??
          (voice.durationMs !== undefined ? voice.durationMs : 1);

        const ratio = Math.min(1, pos / dur);
        setProgress(ratio);

        if (pos >= dur) {
          stopPlayback();
        }
        return;
      });
    } catch (err) {
      console.warn('start playback error', err);
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const handleTogglePlay = async () => {
    if (!voice) return;
    if (isPlaying) {
      await stopPlayback();
    } else {
      await startPlayback();
    }
  };

  const bubbleBaseStyle = [
    styles.messageBubble,
    isMe
      ? { backgroundColor: palette.outgoingBubble ?? palette.primary }
      : {
          backgroundColor:
            palette.incomingBubble ?? palette.surface ?? palette.card,
        },
  ];

  const highlightedStyle = isHighlighted
    ? {
        borderWidth: 2,
        borderColor: palette.highlightBorder ?? palette.primary,
        shadowColor: palette.highlightShadow ?? palette.primary,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      }
    : null;

  const selectedStyle = isSelected
    ? {
        borderWidth: 2,
        borderColor: palette.selectedBorder ?? '#4F46E5',
        backgroundColor: isMe
          ? palette.selectedBgOutgoing ?? '#ffffff22'
          : palette.selectedBgIncoming ?? '#00000011',
      }
    : null;

  const textColor = isMe ? palette.onPrimary ?? '#fff' : palette.text;
  const metaColor = isMe
    ? palette.onPrimaryMuted ?? '#e0e0e0'
    : palette.subtext;

  const status = message.status;
  const statusSymbol = statusToSymbol(status);
  const statusColor =
    status === 'read'
      ? palette.readStatus ?? '#34B7F1'
      : metaColor;

  /* ─────────────────────────────────────────
   * Helper: reply preview
   * ──────────────────────────────────────── */
  const renderReplyPreview = () => {
    if (!replySource) return null;

    const previewText =
      replySource.text ||
      replySource.styledText?.text ||
      (replySource.sticker ? 'Sticker' : '') ||
      (replySource.voice ? 'Voice message' : '') ||
      '';

    const labelColor = isMe
      ? palette.replyPreviewLabelOnOutgoing ?? '#ffffffcc'
      : palette.replyPreviewLabelOnIncoming ?? palette.primary;

    const borderColor = isMe
      ? palette.replyPreviewBorderOnOutgoing ?? '#ffffff55'
      : palette.replyPreviewBorderOnIncoming ?? (palette.primary ?? '#4F46E5');

    const bgColor = isMe
      ? palette.replyPreviewBgOnOutgoing ?? '#00000022'
      : palette.replyPreviewBgOnIncoming ?? '#00000011';

    return (
      <Pressable
        onPress={onPressReplySource}
        style={{
          marginBottom: 6,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderLeftWidth: 3,
          borderLeftColor: borderColor,
          borderRadius: 8,
          backgroundColor: bgColor,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: labelColor,
            marginBottom: 2,
          }}
        >
          Replying to
        </Text>
        {!!previewText && (
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontSize: 12,
              color: isMe ? palette.onPrimary ?? '#fff' : palette.text,
            }}
          >
            {previewText}
          </Text>
        )}
      </Pressable>
    );
  };

  /* ─────────────────────────────────────────
   * -1) Deleted message placeholder
   * ──────────────────────────────────────── */
  if (message.isDeleted) {
    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: palette.deletedBubbleBg ?? '#333',
            },
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: palette.deletedTextColor ?? metaColor,
                fontStyle: 'italic',
              },
            ]}
          >
            Message deleted
          </Text>

          <View style={styles.messageMetaRow}>
            <Text
              style={[
                styles.messageTime,
                {
                  color: metaColor,
                },
              ]}
            >
              {timeLabel}
            </Text>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 0) Sticker bubble
   * ──────────────────────────────────────── */
  if (sticker?.uri) {
    const stickerWidth = sticker.width ?? 180;
    const stickerHeight = sticker.height ?? 180;

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            {
              maxWidth: stickerWidth,
              borderRadius: 16,
              overflow: 'visible',
              backgroundColor: 'transparent',
            },
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          {renderReplyPreview()}

          <Image
            source={{ uri: sticker.uri }}
            style={{ width: stickerWidth, height: stickerHeight }}
            resizeMode="contain"
          />

          {/* time + ticks row */}
          <View
            style={[
              styles.messageMetaRow,
              { paddingHorizontal: 6, paddingBottom: 4 },
            ]}
          >
            <Text
              style={[
                styles.messageTime,
                {
                  color: metaColor,
                },
              ]}
            >
              {timeLabel}
              {message.isEdited ? ' • edited' : ''}
            </Text>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 1) Styled text card (background + font)
   * ──────────────────────────────────────── */
  if (styled) {
    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            {
              maxWidth: '80%',
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: styled.backgroundColor,
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          {renderReplyPreview()}

          <Text
            style={{
              fontSize: styled.fontSize,
              color: styled.fontColor,
              fontFamily: styled.fontFamily || undefined,
              textAlign: 'center',
            }}
          >
            {styled.text}
          </Text>

          {/* time + ticks row */}
          <View style={styles.messageMetaRow}>
            <Text
              style={[
                styles.messageTime,
                {
                  color: metaColor,
                },
              ]}
            >
              {timeLabel}
              {message.isEdited ? ' • edited' : ''}
            </Text>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 2) Voice-only bubble
   * ──────────────────────────────────────── */
  if (isVoiceOnly && voice) {
    const durationLabel = formatTimeFromMs(voice.durationMs);

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowThem,
        ]}
      >
        <View
          style={[
            bubbleBaseStyle,
            selectedStyle || undefined,
            highlightedStyle || undefined,
          ]}
        >
          {renderReplyPreview()}

          <Pressable
            onPress={handleTogglePlay}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <KISIcon
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={palette.onPrimary ?? palette.primary ?? '#fff'}
            />

            <View style={{ flex: 1, marginHorizontal: 8 }}>
              {/* progress track */}
              <View
                style={{
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: isMe
                    ? (palette.onPrimaryMuted ?? '#ffffff55')
                    : (palette.voiceTrackBg ?? '#555'),
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 3,
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: isMe
                      ? (palette.onPrimary ?? '#fff')
                      : (palette.primary ?? '#4F46E5'),
                  }}
                />
              </View>

              {/* duration */}
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: metaColor,
                }}
              >
                {durationLabel}
                {isPlaying ? '  (Playing)' : ''}
              </Text>
            </View>
          </Pressable>

          {/* time + ticks row */}
          <View style={styles.messageMetaRow}>
            <Text
              style={[
                styles.messageTime,
                {
                  color: metaColor,
                },
              ]}
            >
              {timeLabel}
              {message.isEdited ? ' • edited' : ''}
            </Text>

            {isMe && status && (
              <Text
                style={[
                  styles.messageStatus,
                  {
                    color: statusColor,
                  },
                ]}
              >
                {statusSymbol}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  /* ─────────────────────────────────────────
   * 3) Default text bubble
   * ──────────────────────────────────────── */
  return (
    <View
      style={[
        styles.messageRow,
        isMe ? styles.messageRowMe : styles.messageRowThem,
      ]}
    >
      <View
        style={[
          bubbleBaseStyle,
          selectedStyle || undefined,
          highlightedStyle || undefined,
        ]}
      >
        {renderReplyPreview()}

        {!!message.text && (
          <Text
            style={[
              styles.messageText,
              {
                color: textColor,
              },
            ]}
          >
            {message.text}
          </Text>
        )}

        <View style={styles.messageMetaRow}>
          <Text
            style={[
              styles.messageTime,
              {
                color: metaColor,
              },
            ]}
          >
            {timeLabel}
            {message.isEdited ? ' • edited' : ''}
          </Text>

          {isMe && status && (
            <Text
              style={[
                styles.messageStatus,
                {
                  color: statusColor,
                },
              ]}
            >
              {statusSymbol}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const statusToSymbol = (status?: ChatMessage['status']) => {
  if (!status) return '';
  if (status === 'local_only' || status === 'pending' || status === 'sending')
    return '⏳';
  if (status === 'sent') return '✓';
  if (status === 'delivered') return '✓✓';
  if (status === 'read') return '✓✓';
  if (status === 'failed') return '!';
  return '';
};
