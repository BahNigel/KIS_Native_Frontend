// src/screens/chat/components/MessageComposer.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  Image,
} from 'react-native';

import AudioRecorderPlayer, {
  PlayBackType,
} from 'react-native-audio-recorder-player';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sticker, STICKER_STORAGE_KEY } from './StickerEditor';
import { ChatMessage } from '../../chatTypes';
import { AVATAR_OPTIONS, AvatarPicker } from '../AvatarPicker';
import { EmojiPicker } from '../EmojiPicker';
import { KISIcon } from '@/constants/kisIcons';
import { HoldToLockComposer } from '../HoldToLockComposer';
import { chatRoomStyles as styles } from '@/src/Module/ChatRoom/chatRoomStyles'
/* -------------------------------------------------------------------------- */
/*                          STICKER PICKER (BOTTOM PANEL)                     */
/* -------------------------------------------------------------------------- */

const StickerPicker = ({
  palette,
  stickers,
  onCreateStickerPress,
  onSelectSticker,
}: {
  palette: any;
  stickers: Sticker[];
  onCreateStickerPress: () => void;
  onSelectSticker: (sticker: Sticker) => void;
}) => {
  return (
    <View style={{ padding: 12 }}>
      {/* CREATE STICKER BUTTON */}
      <Pressable
        onPress={onCreateStickerPress}
        style={{
          marginBottom: 12,
          backgroundColor: palette.primary,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          alignSelf: 'flex-start',
        }}
      >
        <Text style={{ color: palette.onPrimary, fontWeight: '600' }}>
          + Create New Sticker
        </Text>
      </Pressable>

      {/* STICKER GRID */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {stickers.length === 0 && (
          <Text style={{ color: palette.subtext, fontSize: 13 }}>
            No stickers yet. Create one!
          </Text>
        )}

        {stickers.map((sticker) => (
          <Pressable
            key={sticker.id}
            onPress={() => onSelectSticker(sticker)}
            style={{
              width: 80,
              height: 80,
              margin: 6,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: palette.surface,
            }}
          >
            <Image
              source={{ uri: sticker.uri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                              AUDIO PLAYER                                  */
/* -------------------------------------------------------------------------- */

const audioRecorderPlayer = new AudioRecorderPlayer();
audioRecorderPlayer.setSubscriptionDuration(0.1);

/* -------------------------------------------------------------------------- */
/*                              COMPONENT PROPS                                */
/* -------------------------------------------------------------------------- */

type MessageComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  palette: any;
  disabled?: boolean;

  onSendVoice?: (payload: { uri: string; durationMs: number }) => void;
  onChooseTextBackground?: (backgroundColor: string) => void;

  // send sticker message upward to ChatRoomPage
  onSendSticker?: (sticker: Sticker) => void;

  // trigger opening full-screen sticker editor
  onOpenStickerEditor?: () => void;

  // bump this when the sticker library changes
  stickerVersion?: number;

  // NEW: reply / edit support
  replyTo?: ChatMessage | null;
  onClearReply?: () => void;
  editing?: ChatMessage | null;
  onCancelEditing?: () => void;
};

/* -------------------------------------------------------------------------- */
/*                           MESSAGE COMPOSER                                 */
/* -------------------------------------------------------------------------- */

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChangeText,
  onSend,
  canSend,
  palette,
  disabled,
  onSendVoice,
  onChooseTextBackground,
  onSendSticker,
  onOpenStickerEditor,
  stickerVersion = 0,
  replyTo,
  onClearReply,
  editing,
  onCancelEditing,
}) => {
  /* ----------------------------- VOICE STATE ----------------------------- */
  const [recordUri, setRecordUri] = useState<string | null>(null);
  const [recordMs, setRecordMs] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const playListenerActiveRef = useRef(false);

  /* ----------------------------- STICKER STORAGE -------------------------- */
  const [stickers, setStickers] = useState<Sticker[]>([]);

  const loadStickers = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STICKER_STORAGE_KEY);

      if (!raw) {
        setStickers([]);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to parse stickers from storage', e);
        setStickers([]);
        return;
      }

      const list = Array.isArray(parsed) ? parsed : [];

      const cleaned: Sticker[] = list
        .filter((s: any) => s && typeof s.uri === 'string')
        .map((s: any, index: number) => ({
          id: String(s.id ?? `local-${Date.now()}-${index}`),
          uri: String(s.uri),
          text: typeof s.text === 'string' ? s.text : undefined,
          fileType: 'kis-sticker',
          mimeType: (s.mimeType as string) ?? 'image/png',
          extension: (s.extension as string) ?? '.kisstk',
          metaPath: (s.metaPath as string) ?? '',
        }));

      setStickers(cleaned);
    } catch (err) {
      console.warn('Failed to load stickers', err);
      setStickers([]);
    }
  }, []);

  /* ----------------------------- INITIAL LOAD ----------------------------- */
  useEffect(() => {
    loadStickers();
  }, [loadStickers]);

  // Reload whenever stickerVersion changes (e.g. after saving a new sticker)
  useEffect(() => {
    loadStickers();
  }, [stickerVersion, loadStickers]);

  /* ----------------------------- PANEL STATE ------------------------------ */
  const [keyboardMode, setKeyboardMode] = useState(true);

  // DEFAULT TAB → emoji
  const [panelTab, setPanelTab] =
    useState<'custom' | 'emoji' | 'stickers'>('emoji');

  const textInputRef = useRef<TextInput | null>(null);

  /* ----------------------------- CUSTOM (background text card) ------------ */
  const [avatarId, setAvatarId] = useState('sunrise_orange');

  const handleSelectAvatar = (id: string) => {
    setAvatarId(id);
    const avatar = AVATAR_OPTIONS.find((a) => a.id === id);
    if (avatar) {
      onChooseTextBackground?.(avatar.bgColor);
    }
  };

  /* ----------------------------- CLEANUP EFFECT --------------------------- */
  useEffect(() => {
    return () => {
      try {
        audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
      } catch {}
      try {
        audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      } catch {}
    };
  }, []);

  /* ----------------------------- PLAYBACK CONTROL ------------------------- */
  const stopPreviewPlayback = async () => {
    try {
      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
    } catch {}
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  };

  const startPreviewPlayback = async () => {
    if (!recordUri) return;
    try {
      setIsPlayingPreview(true);
      await audioRecorderPlayer.startPlayer(recordUri);
      playListenerActiveRef.current = true;

      const estimatedDur = recordMs || 1;

      audioRecorderPlayer.addPlayBackListener((e: PlayBackType) => {
        const pos = e.currentPosition ?? 0;
        const dur = e.duration ?? estimatedDur;
        setPreviewProgress(Math.min(1, pos / dur));

        if (pos >= dur) stopPreviewPlayback();
        return;
      });
    } catch {
      stopPreviewPlayback();
    }
  };

  const handleTextSend = () => {
    if (!canSend || disabled) return;
    onSend();
  };

  /* ----------------------------- PANEL TOGGLING --------------------------- */
  const toggleEmojiKeyboard = () => {
    if (keyboardMode) {
      // OPEN PANEL → default to Emoji tab
      setKeyboardMode(false);
      setPanelTab('emoji');
      textInputRef.current?.blur();
    } else {
      // CLOSE PANEL → go back to keyboard
      setKeyboardMode(true);
      textInputRef.current?.focus();
    }
  };

  // Voice activity flag for hiding the text input + buttons
  const isVoiceActive = isRecording || previewVisible;

  const showTextSend = canSend && !isRecording && !previewVisible;

  /* -------------------------------------------------------------------------- */
  /*                             PANEL CONTENT                                  */
  /* -------------------------------------------------------------------------- */

  // Reload when user switches into stickers tab
  useEffect(() => {
    if (panelTab === 'stickers') {
      loadStickers();
    }
  }, [panelTab, loadStickers]);

  const renderPanelContent = () => {
    switch (panelTab) {
      case 'custom':
        return (
          <AvatarPicker
            palette={palette}
            selectedAvatarId={avatarId}
            onSelectAvatar={handleSelectAvatar}
          />
        );

      case 'emoji':
        return (
          <EmojiPicker
            palette={palette}
            onSelectEmoji={(emoji) => onChangeText(value + emoji)}
          />
        );

      case 'stickers':
        return (
          <StickerPicker
            palette={palette}
            stickers={stickers}
            onCreateStickerPress={() => {
              if (onOpenStickerEditor) onOpenStickerEditor();
            }}
            onSelectSticker={(sticker) => {
              onSendSticker?.(sticker);
              // Close panel after sending sticker
              setKeyboardMode(true);
              textInputRef.current?.focus();
            }}
          />
        );

      default:
        return (
          <AvatarPicker
            palette={palette}
            selectedAvatarId={avatarId}
            onSelectAvatar={handleSelectAvatar}
          />
        );
    }
  };

  /* ----------------------------- TAB BAR ----------------------------------- */
  const renderTabBar = () => {
    const tabs = [
      { id: 'custom', label: 'Custom' },
      { id: 'emoji', label: 'Emoji' },
      { id: 'stickers', label: 'Stickers' },
    ] as const;

    return (
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderColor: palette.divider,
          paddingHorizontal: 8,
          paddingVertical: 6,
        }}
      >
        {tabs.map((t) => {
          const active = panelTab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setPanelTab(t.id)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: active ? palette.primary : 'transparent',
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: active ? palette.onPrimary : palette.text,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  /* ----------------------------- REPLY / EDIT BANNER ----------------------- */

  const renderReplyOrEditBanner = () => {
    if (editing) {
      const snippet =
        editing.text ||
        editing.styledText?.text ||
        (editing.sticker ? 'Sticker' : '') ||
        (editing.voice ? 'Voice message' : '') ||
        '';

      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.replyBannerBg ?? palette.card,
          }}
        >
          <KISIcon
            name="edit"
            size={16}
            color={palette.primary}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: palette.primary,
              }}
            >
              Editing
            </Text>
            {!!snippet && (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 12,
                  color: palette.subtext,
                }}
              >
                {snippet}
              </Text>
            )}
          </View>
          {onCancelEditing && (
            <Pressable onPress={onCancelEditing}>
              <KISIcon
                name='close'
                size={16}
                color={palette.subtext}
              />
            </Pressable>
          )}
        </View>
      );
    }

    if (replyTo) {
      const snippet =
        replyTo.text ||
        replyTo.styledText?.text ||
        (replyTo.sticker ? 'Sticker' : '') ||
        (replyTo.voice ? 'Voice message' : '') ||
        '';

      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderColor: palette.divider,
            backgroundColor: palette.replyBannerBg ?? palette.card,
          }}
        >
          <KISIcon
            name="reply"
            size={16}
            color={palette.primary}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: palette.primary,
              }}
            >
              Replying
            </Text>
            {!!snippet && (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 12,
                  color: palette.subtext,
                }}
              >
                {snippet}
              </Text>
            )}
          </View>
          {onClearReply && (
            <Pressable onPress={onClearReply}>
              <KISIcon
                name='close'
                size={16}
                color={palette.subtext}
              />
            </Pressable>
          )}
        </View>
      );
    }

    return null;
  };

  /* -------------------------------------------------------------------------- */
  /*                                  RENDER                                     */
  /* -------------------------------------------------------------------------- */
  return (
    <View
      style={[
        styles.composerContainer,
        {
          borderTopColor: palette.divider,
          backgroundColor: palette.chatComposerBg ?? palette.card,
        },
      ]}
    >
      {/* REPLY / EDIT BANNER */}
      {renderReplyOrEditBanner()}

      {/* MAIN INPUT ROW */}
      <View style={styles.composerMainRow}>
        {/* TOGGLE + INPUT + ACTIONS (hidden during recording/preview) */}
        {!isVoiceActive && (
          <>
            <Pressable
              onPress={toggleEmojiKeyboard}
              style={styles.iconTextButton}
            >
              <KISIcon
                name={keyboardMode ? 'smiley' : 'keyboard'}
                size={22}
                color={palette.subtext}
              />
            </Pressable>

            <View
              style={[
                styles.composerInputWrapper,
                {
                  backgroundColor: palette.composerInputBg,
                  borderColor: palette.composerInputBorder ?? 'transparent',
                },
              ]}
            >
              <TextInput
                ref={textInputRef}
                value={value}
                editable={!disabled}
                onChangeText={onChangeText}
                placeholder={
                  editing
                    ? 'Edit message'
                    : replyTo
                    ? 'Reply...'
                    : 'Message'
                }
                placeholderTextColor={palette.subtext}
                multiline
                style={[styles.composerInput, { color: palette.text }]}
              />
            </View>

            {/* ACTIONS */}
            <Pressable style={styles.iconTextButton}>
              <KISIcon name="add" size={22} color={palette.subtext} />
            </Pressable>

            <Pressable style={styles.iconTextButton}>
              <KISIcon name="camera" size={22} color={palette.subtext} />
            </Pressable>
          </>
        )}

        {/* SEND / VOICE */}
        {showTextSend ? (
          <Pressable
            onPress={handleTextSend}
            style={[
              styles.composerActionButton,
              {
                backgroundColor: palette.primary,
                marginRight: 12,
                height: 50,
                width: 50,
              },
            ]}
          >
            <KISIcon name="send" size={18} color={palette.onPrimary} />
          </Pressable>
        ) : (
         <HoldToLockComposer
            palette={palette}
            onSendVoice={onSendVoice}
            setIsRecording={setIsRecording}
          />
        )}
      </View>

      {/* PANEL */}
      {!keyboardMode && !disabled && !isVoiceActive && (
        <View>
          {renderTabBar()}
          {renderPanelContent()}
        </View>
      )}
    </View>
  );
};
