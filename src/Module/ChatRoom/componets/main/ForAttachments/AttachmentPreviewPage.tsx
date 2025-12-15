import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  ScrollView,
  TextInput,
} from 'react-native';
import AudioRecorderPlayer, {
  PlayBackType,
} from 'react-native-audio-recorder-player';

import { KISIcon } from '@/constants/kisIcons';
import {
  KIS_TOKENS,
  kisRadius,
  KISPalette,
} from '@/theme/constants';
import { AttachmentFilePayload } from '../AttachmentSheet';

export type PreviewKind = 'file' | 'audio';

type AttachmentPreviewPageProps = {
  visible: boolean;
  palette: KISPalette;
  kind: PreviewKind | null;
  items: AttachmentFilePayload[];
  onCancel: () => void;
  onSend: (caption: string) => void;
};

const isPdfFile = (item: AttachmentFilePayload) => {
  const type = item.type || '';
  const lowerName = item.name?.toLowerCase?.() ?? '';
  if (type === 'application/pdf') return true;
  if (lowerName.endsWith('.pdf')) return true;
  return false;
};

const getFileIconAndColor = (
  item: AttachmentFilePayload,
): { icon: React.ComponentProps<typeof KISIcon>['name']; colorKey: 'primary' | 'secondary' | 'info' | 'success' | 'warning' } => {
  const name = item.name?.toLowerCase?.() ?? '';
  const type = item.type || '';

  if (isPdfFile(item)) {
    return { icon: 'file', colorKey: 'error' as any }; // fallback if no error color in palette
  }

  if (
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { icon: 'file', colorKey: 'primary' };
  }

  if (
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    type ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return { icon: 'file', colorKey: 'success' };
  }

  if (
    name.endsWith('.ppt') ||
    name.endsWith('.pptx') ||
    type ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return { icon: 'file', colorKey: 'warning' };
  }

  return { icon: 'file', colorKey: 'secondary' };
};

export const AttachmentPreviewPage: React.FC<AttachmentPreviewPageProps> = ({
  visible,
  palette,
  kind,
  items,
  onCancel,
  onSend,
}) => {
  const cardRadius = kisRadius.xl ?? 20;
  const [captionText, setCaptionText] = useState('');
  const [localItems, setLocalItems] = useState<AttachmentFilePayload[]>([]);

  // AUDIO PLAYER STATE
  const audioPlayerRef = useRef(new AudioRecorderPlayer());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    if (visible) {
      setCaptionText('');
      setLocalItems(items ?? []);
      setPlayingId(null);
      setAudioProgress({});
      try {
        audioPlayerRef.current.stopPlayer();
        audioPlayerRef.current.removePlayBackListener();
      } catch {}
    }
  }, [visible, items]);

  useEffect(() => {
    return () => {
      try {
        audioPlayerRef.current.stopPlayer();
        audioPlayerRef.current.removePlayBackListener();
      } catch {}
    };
  }, []);

  const handleClose = () => {
    console.log('[AttachmentPreviewPage] handleClose');
    setCaptionText('');
    setLocalItems([]);
    setPlayingId(null);
    setAudioProgress({});
    try {
      audioPlayerRef.current.stopPlayer();
      audioPlayerRef.current.removePlayBackListener();
    } catch {}
    onCancel();
  };

  const handleSendPress = () => {
    console.log('[AttachmentPreviewPage] handleSendPress', {
      captionText,
      kind,
      itemsLength: localItems.length,
    });
    const trimmed = captionText.trim();
    onSend(trimmed);
    setCaptionText('');
    setPlayingId(null);
    setAudioProgress({});
  };

  const handleRemoveItem = (index: number) => {
    if (localItems.length <= 1) return; // cannot remove last item
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
  };

  const isSinglePdf = useMemo(() => {
    return localItems.length === 1 && isPdfFile(localItems[0]);
  }, [localItems]);

  const stopAudio = async () => {
    try {
      await audioPlayerRef.current.stopPlayer();
      audioPlayerRef.current.removePlayBackListener();
    } catch {}
    setPlayingId(null);
  };

  const playAudio = async (item: AttachmentFilePayload) => {
    if (!item.uri) return;

    if (playingId === item.uri) {
      await stopAudio();
      return;
    }

    try {
      await stopAudio();
    } catch {}

    try {
      setPlayingId(item.uri);
      await audioPlayerRef.current.startPlayer(item.uri);
      audioPlayerRef.current.addPlayBackListener((e: PlayBackType) => {
        const dur = e.duration || 1;
        const pos = e.currentPosition || 0;
        const progress = Math.min(1, Math.max(0, pos / dur));
        setAudioProgress((prev) => ({
          ...prev,
          [item.uri]: progress,
        }));
        if (pos >= dur) {
          stopAudio();
        }
        return;
      });
    } catch (err) {
      console.warn(
        '[AttachmentPreviewPage] error playing audio',
        err,
      );
      stopAudio();
    }
  };

  if (!kind || !localItems.length) {
    console.log(
      '[AttachmentPreviewPage] returning null (no kind/items)',
      {
        kind,
        itemsLength: localItems.length,
      },
    );
    return null;
  }

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={handleClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: palette.backdrop || 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          paddingHorizontal: KIS_TOKENS.spacing.lg,
        }}
        onPress={() => {
          console.log(
            '[AttachmentPreviewPage] backdrop pressed -> close',
          );
          handleClose();
        }}
      >
        <Pressable
          onPress={(e) => {
            console.log(
              '[AttachmentPreviewPage] inner card pressed (stop propagation)',
            );
            e.stopPropagation();
          }}
          style={{
            backgroundColor:
              (palette.surfaceElevated as string) ||
              (palette.surface as string) ||
              '#ffffff',
            borderRadius: cardRadius,
            padding: KIS_TOKENS.spacing.lg,
            ...KIS_TOKENS.elevation.modal,
            maxHeight: '85%',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: KIS_TOKENS.spacing.md,
            }}
          >
            <KISIcon
              name={kind === 'audio' ? 'audio' : 'file'}
              size={18}
              color={palette.primary}
            />
            <Text
              style={{
                marginLeft: 8,
                fontSize: KIS_TOKENS.typography.title,
                fontWeight: KIS_TOKENS.typography.weight.bold,
                color: palette.text,
              }}
            >
              Preview attachments
            </Text>
          </View>

          {/* Single PDF thumbnail-like card */}
          {isSinglePdf && (
            <View
              style={{
                marginBottom: KIS_TOKENS.spacing.md,
                borderRadius: kisRadius.lg,
                borderWidth: 1,
                borderColor: palette.divider,
                padding: KIS_TOKENS.spacing.md,
                backgroundColor: palette.surface,
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: KIS_TOKENS.spacing.sm,
                }}
              >
                <KISIcon
                  name="file"
                  size={40}
                  color={palette.error ?? palette.primary}
                />
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: KIS_TOKENS.typography.label,
                    fontWeight: KIS_TOKENS.typography.weight.medium,
                    color: palette.text,
                  }}
                  numberOfLines={2}
                >
                  {localItems[0].name}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: KIS_TOKENS.typography.tiny,
                    color: palette.subtext,
                  }}
                >
                  PDF document
                </Text>
              </View>
            </View>
          )}

          {/* Items list (files + audio) */}
          <ScrollView
            style={{ maxHeight: 260, marginBottom: KIS_TOKENS.spacing.md }}
          >
            {localItems.map((item, index) => {
              const isAudio =
                (item.type || '').startsWith('audio/') ||
                kind === 'audio';
              const canRemove = localItems.length > 1;
              const progress = audioProgress[item.uri] ?? 0;

              if (isAudio) {
                return (
                  <View
                    key={`${item.uri}-${item.name}-${index}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: KIS_TOKENS.spacing.sm,
                    }}
                  >
                    <Pressable
                      onPress={() => playAudio(item)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: KIS_TOKENS.spacing.sm,
                        backgroundColor: palette.primarySoft,
                      }}
                    >
                      <KISIcon
                        name={
                          playingId === item.uri ? 'pause' : 'play'
                        }
                        size={22}
                        color={palette.primary}
                      />
                    </Pressable>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: KIS_TOKENS.typography.label,
                          fontWeight:
                            KIS_TOKENS.typography.weight.medium,
                          color: palette.text,
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <View
                        style={{
                          marginTop: 4,
                          height: 4,
                          borderRadius: 999,
                          backgroundColor: palette.divider,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${progress * 100}%`,
                            height: '100%',
                            backgroundColor: palette.primary,
                          }}
                        />
                      </View>
                    </View>

                    {canRemove && (
                      <Pressable
                        onPress={() => handleRemoveItem(index)}
                        style={{
                          marginLeft: KIS_TOKENS.spacing.sm,
                          padding: 6,
                        }}
                      >
                        <KISIcon
                          name="trash"
                          size={18}
                          color={palette.subtext}
                        />
                      </Pressable>
                    )}
                  </View>
                );
              }

              // generic file
              const { icon, colorKey } = getFileIconAndColor(item);
              const bgColor =
                palette[`${colorKey}Soft` as keyof KISPalette] ||
                palette.surface;
              const iconColor =
                palette[colorKey as keyof KISPalette] ||
                palette.primary;

              return (
                <View
                  key={`${item.uri}-${item.name}-${index}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: KIS_TOKENS.spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: kisRadius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: KIS_TOKENS.spacing.sm,
                      backgroundColor: bgColor as string,
                    }}
                  >
                    <KISIcon name={icon} size={24} color={iconColor as string} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: KIS_TOKENS.typography.label,
                        fontWeight:
                          KIS_TOKENS.typography.weight.medium,
                        color: palette.text,
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: KIS_TOKENS.typography.tiny,
                        color: palette.subtext,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {item.type || 'Unknown type'}
                    </Text>
                  </View>

                  {canRemove && (
                    <Pressable
                      onPress={() => handleRemoveItem(index)}
                      style={{
                        marginLeft: KIS_TOKENS.spacing.sm,
                        padding: 6,
                      }}
                    >
                      <KISIcon
                        name="trash"
                        size={18}
                        color={palette.subtext}
                      />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Caption input */}
          <TextInput
            value={captionText}
            onChangeText={(txt) => {
              console.log(
                '[AttachmentPreviewPage] captionText changed',
                txt,
              );
              setCaptionText(txt);
            }}
            placeholder="Add a message..."
            placeholderTextColor={palette.subtext}
            multiline
            style={{
              minHeight: 60,
              maxHeight: 120,
              borderRadius: kisRadius.md,
              borderWidth: 1,
              borderColor: palette.divider,
              paddingHorizontal: KIS_TOKENS.spacing.md,
              paddingVertical: KIS_TOKENS.spacing.sm,
              fontSize: KIS_TOKENS.typography.body,
              color: palette.text,
            }}
          />

          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginTop: KIS_TOKENS.spacing.md,
            }}
          >
            <Pressable
              onPress={() => {
                console.log(
                  '[AttachmentPreviewPage] Cancel button pressed',
                );
                handleClose();
              }}
              style={({ pressed }) => ({
                paddingHorizontal: KIS_TOKENS.spacing.md,
                paddingVertical: KIS_TOKENS.spacing.sm,
                borderRadius: kisRadius.md,
                marginRight: KIS_TOKENS.spacing.sm,
                opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
              })}
            >
              <Text
                style={{
                  fontSize: KIS_TOKENS.typography.label,
                  color: palette.subtext,
                }}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                console.log(
                  '[AttachmentPreviewPage] Send button pressed',
                  { captionText },
                );
                handleSendPress();
              }}
              style={({ pressed }) => ({
                paddingHorizontal: KIS_TOKENS.spacing.lg,
                paddingVertical: KIS_TOKENS.spacing.sm,
                borderRadius: kisRadius.md,
                backgroundColor: palette.primary,
                opacity: pressed ? KIS_TOKENS.opacity.pressed : 1,
              })}
            >
              <Text
                style={{
                  fontSize: KIS_TOKENS.typography.label,
                  fontWeight: KIS_TOKENS.typography.weight.bold,
                  color: palette.onPrimary,
                }}
              >
                Send
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
