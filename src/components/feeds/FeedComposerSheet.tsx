import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';

type ComposerType =
  | 'text'
  | 'styled_text'
  | 'image'
  | 'video'
  | 'short_video'
  | 'document'
  | 'audio'
  | 'poll'
  | 'event'
  | 'link';

export type FeedComposerPayload = {
  text?: string;
  styled_text?: {
    text: string;
    backgroundColor: string;
    fontColor: string;
    backgroundImage?: string | null;
  };
  attachments?: any[];
  poll?: any;
  event?: any;
  link?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: FeedComposerPayload) => Promise<void> | void;
};

const COLOR_CHOICES = [
  '#0B1E3B',
  '#0F3D2E',
  '#3B1E0B',
  '#2A2356',
  '#5A1A27',
  '#123456',
  '#14532D',
];

const makeAttachment = (file: {
  uri: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
  kind?: string;
}) => ({
  id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  url: file.uri,
  originalName: file.name || 'file',
  mimeType: file.type || 'application/octet-stream',
  size: file.size ?? 0,
  kind: file.kind ?? 'file',
});

export default function FeedComposerSheet({ visible, onClose, onSubmit }: Props) {
  const { palette } = useKISTheme();
  const [step, setStep] = useState<'picker' | 'form'>('picker');
  const [type, setType] = useState<ComposerType>('text');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [styledBg, setStyledBg] = useState(COLOR_CHOICES[0]);
  const [styledImage, setStyledImage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [videoThumbUri, setVideoThumbUri] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sheetY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (!visible) return;
    setStep('picker');
    setType('text');
    Animated.timing(sheetY, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, sheetY]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 600,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setText('');
      setLink('');
      setStyledBg(COLOR_CHOICES[0]);
      setStyledImage(null);
      setAttachments([]);
      setVideoThumbUri(null);
      setPollQuestion('');
      setPollOptions(['', '']);
      setEventTitle('');
      setEventStartsAt('');
      setEventLocation('');
      onClose();
    });
  }, [sheetY, onClose]);

  const pickImage = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    setAttachments([makeAttachment({
      uri: asset.uri,
      name: asset.fileName,
      type: asset.type,
      size: asset.fileSize,
      kind: 'image',
    })]);
  }, []);

  const pickVideo = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    setVideoThumbUri(null);
    setAttachments([makeAttachment({
      uri: asset.uri,
      name: asset.fileName,
      type: asset.type,
      size: asset.fileSize,
      kind: 'video',
    })]);
  }, []);

  const pickDocument = useCallback(async (kind: 'document' | 'audio') => {
    try {
      const docTypes = [
        DocumentPicker.types.pdf,
        DocumentPicker.types.doc,
        DocumentPicker.types.docx,
      ].filter(Boolean);
      const doc = await DocumentPicker.pickSingle({
        type: kind === 'audio' ? DocumentPicker.types.audio : docTypes,
      });
      setAttachments([makeAttachment({
        uri: doc.uri,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        kind: kind === 'audio' ? 'audio' : 'file',
      })]);
    } catch {}
  }, []);

  const pickStyledBackground = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset?.uri) setStyledImage(asset.uri);
  }, []);

  const pickVideoThumbnail = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset?.uri) setVideoThumbUri(asset.uri);
  }, []);

  const submit = useCallback(async () => {
    if (submitting) return;
    const trimmed = text.trim();
    const payload: FeedComposerPayload = {};

    if (type === 'text') {
      if (!trimmed) return;
      payload.text = trimmed;
    }

    if (type === 'styled_text') {
      if (!trimmed) return;
      payload.styled_text = {
        text: trimmed,
        backgroundColor: styledBg,
        fontColor: '#FFFFFF',
        backgroundImage: styledImage,
      };
    }

    if (['image', 'video', 'short_video', 'document', 'audio'].includes(type)) {
      if (!attachments.length && !trimmed) return;
      if ((type === 'video' || type === 'short_video') && attachments.length && videoThumbUri) {
        payload.attachments = [{ ...attachments[0], thumbUrl: videoThumbUri }];
      } else {
        payload.attachments = attachments;
      }
      payload.text = trimmed || undefined;
    }

    if (type === 'poll') {
      const options = pollOptions.map((opt) => opt.trim()).filter(Boolean);
      if (!pollQuestion.trim() || options.length < 2) return;
      payload.poll = {
        question: pollQuestion.trim(),
        options: options.map((opt, idx) => ({ id: `opt_${idx + 1}`, text: opt })),
      };
    }

    if (type === 'event') {
      if (!eventTitle.trim() || !eventStartsAt.trim()) return;
      payload.event = {
        title: eventTitle.trim(),
        startsAt: eventStartsAt.trim(),
        location: eventLocation.trim() || undefined,
      };
    }

    if (type === 'link') {
      if (!link.trim()) return;
      payload.link = link.trim();
      payload.text = trimmed || undefined;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
      closeSheet();
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    text,
    styledBg,
    styledImage,
    attachments,
    pollQuestion,
    pollOptions,
    eventTitle,
    eventStartsAt,
    eventLocation,
    link,
    type,
    onSubmit,
    closeSheet,
  ]);

  const options = useMemo(
    () => [
      { key: 'text', label: 'Text', icon: 'edit' },
      { key: 'styled_text', label: 'Styled', icon: 'layers' },
      { key: 'image', label: 'Image', icon: 'image' },
      { key: 'video', label: 'Video', icon: 'video' },
      { key: 'short_video', label: 'Short video', icon: 'video' },
      { key: 'document', label: 'PDF / Word', icon: 'file-pdf' },
      { key: 'audio', label: 'Audio', icon: 'audio' },
      { key: 'poll', label: 'Poll', icon: 'poll' },
      { key: 'event', label: 'Event', icon: 'calendar' },
      { key: 'link', label: 'Link', icon: 'copy' },
    ],
    [],
  );

  const renderFormBody = () => {
    if (type === 'styled_text') {
      return (
        <>
          <TextInput
            placeholder="Write your styled update..."
            placeholderTextColor={palette.subtext}
            value={text}
            onChangeText={setText}
            multiline
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
          <Text style={[styles.sectionTitle, { color: palette.subtext }]}>Background</Text>
          <View style={styles.colorRow}>
            {COLOR_CHOICES.map((color) => (
              <Pressable
                key={color}
                onPress={() => setStyledBg(color)}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color,
                    borderColor: styledBg === color ? palette.primary : 'transparent',
                  },
                ]}
              />
            ))}
          </View>
          <Pressable onPress={pickStyledBackground} style={[styles.secondaryButton, { borderColor: palette.divider }]}>
            <Text style={{ color: palette.text }}>Add background image</Text>
          </Pressable>
          {styledImage ? (
            <Text style={{ color: palette.subtext, marginTop: 6 }}>Background selected</Text>
          ) : null}
        </>
      );
    }

    if (type === 'poll') {
      return (
        <>
          <TextInput
            placeholder="Poll question"
            placeholderTextColor={palette.subtext}
            value={pollQuestion}
            onChangeText={setPollQuestion}
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
          {pollOptions.map((opt, idx) => (
            <TextInput
              key={`poll-opt-${idx}`}
              placeholder={`Option ${idx + 1}`}
              placeholderTextColor={palette.subtext}
              value={opt}
              onChangeText={(value) =>
                setPollOptions((prev) => prev.map((o, i) => (i === idx ? value : o)))
              }
              style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
            />
          ))}
          <Pressable
            onPress={() => setPollOptions((prev) => [...prev, ''])}
            style={[styles.secondaryButton, { borderColor: palette.divider }]}
          >
            <Text style={{ color: palette.text }}>Add option</Text>
          </Pressable>
        </>
      );
    }

    if (type === 'event') {
      return (
        <>
          <TextInput
            placeholder="Event title"
            placeholderTextColor={palette.subtext}
            value={eventTitle}
            onChangeText={setEventTitle}
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
          <TextInput
            placeholder="Start date/time (YYYY-MM-DD HH:MM)"
            placeholderTextColor={palette.subtext}
            value={eventStartsAt}
            onChangeText={setEventStartsAt}
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
          <TextInput
            placeholder="Location (optional)"
            placeholderTextColor={palette.subtext}
            value={eventLocation}
            onChangeText={setEventLocation}
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
        </>
      );
    }

    if (type === 'link') {
      return (
        <>
          <TextInput
            placeholder="Paste a link"
            placeholderTextColor={palette.subtext}
            value={link}
            onChangeText={setLink}
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
          <TextInput
            placeholder="Add a caption (optional)"
            placeholderTextColor={palette.subtext}
            value={text}
            onChangeText={setText}
            multiline
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
        </>
      );
    }

    if (['image', 'video', 'short_video', 'document', 'audio'].includes(type)) {
      const pickLabel =
        type === 'image'
          ? 'Pick image'
          : type === 'video' || type === 'short_video'
            ? 'Pick video'
            : type === 'audio'
              ? 'Pick audio'
              : 'Pick document';
      return (
        <>
          <Pressable
            onPress={() => {
              if (type === 'image') pickImage();
              else if (type === 'video' || type === 'short_video') pickVideo();
              else if (type === 'audio') pickDocument('audio');
              else pickDocument('document');
            }}
            style={[styles.secondaryButton, { borderColor: palette.divider }]}
          >
            <Text style={{ color: palette.text }}>{pickLabel}</Text>
          </Pressable>
          {type === 'video' || type === 'short_video' ? (
            <Pressable
              onPress={pickVideoThumbnail}
              style={[styles.secondaryButton, { borderColor: palette.divider }]}
            >
              <Text style={{ color: palette.text }}>Add video thumbnail</Text>
            </Pressable>
          ) : null}
          {attachments.length ? (
            <Text style={{ color: palette.subtext, marginTop: 6 }}>
              Selected: {attachments[0]?.originalName ?? 'file'}
            </Text>
          ) : null}
          {videoThumbUri ? (
            <Text style={{ color: palette.subtext, marginTop: 6 }}>
              Thumbnail selected
            </Text>
          ) : null}
          <TextInput
            placeholder="Add a caption (optional)"
            placeholderTextColor={palette.subtext}
            value={text}
            onChangeText={setText}
            multiline
            style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
          />
        </>
      );
    }

    return (
      <TextInput
        placeholder="Write your update..."
        placeholderTextColor={palette.subtext}
        value={text}
        onChangeText={setText}
        multiline
        style={[styles.input, { color: palette.text, borderColor: palette.divider }]}
      />
    );
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={closeSheet}>
      <Pressable style={styles.backdrop} onPress={closeSheet} />
      <Animated.View style={[styles.sheet, { backgroundColor: palette.card, transform: [{ translateY: sheetY }] }]}>
        {step === 'picker' ? (
          <>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>Create post</Text>
              <Pressable onPress={closeSheet}>
                <KISIcon name="close" size={20} color={palette.text} />
              </Pressable>
            </View>
            <View style={styles.optionGrid}>
              {options.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setType(opt.key as ComposerType);
                    setStep('form');
                  }}
                  style={[styles.optionCard, { borderColor: palette.divider }]}
                >
                  <KISIcon name={opt.icon as any} size={20} color={palette.primary} />
                  <Text style={{ color: palette.text, marginTop: 6, fontSize: 12 }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setStep('picker')} style={{ padding: 6 }}>
                <KISIcon name="arrow-left" size={18} color={palette.text} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>
                {options.find((opt) => opt.key === type)?.label ?? 'Create post'}
              </Text>
              <Pressable onPress={closeSheet}>
                <KISIcon name="close" size={20} color={palette.text} />
              </Pressable>
            </View>
            <View style={styles.formBody}>{renderFormBody()}</View>
            <Pressable
              onPress={submit}
              style={[
                styles.submitButton,
                { backgroundColor: palette.primary, opacity: submitting ? 0.7 : 1 },
              ]}
              disabled={submitting}
            >
              <Text style={{ color: palette.onPrimary ?? '#fff', fontWeight: '700' }}>
                {submitting ? 'Posting…' : 'Post'}
              </Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: '30%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBody: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
});
