import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import { resolveBackendAssetUrl } from '@/network';
import type { BroadcastItem } from '@/types/broadcast';

const pickAttachmentUrl = (attachment: any): string | undefined => {
  if (!attachment) return undefined;
  if (typeof attachment === 'string') return attachment;
  return (
    attachment.fileUrl ??
    attachment.url ??
    attachment.uri ??
    attachment.file_url ??
    attachment.path ??
    attachment.previewUrl ??
    attachment.preview_url
  );
};

const formatDate = (value: string | undefined) => {
  if (!value) return 'Moments ago';
  try {
    const diff = Math.max(new Date().getTime() - new Date(value).getTime(), 0);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Moments ago';
  }
};

type Props = {
  item: BroadcastItem;
  onPress: () => void;
  onReact: () => void;
};

export default function FeedItemCard({ item, onPress, onReact }: Props) {
  const { palette } = useKISTheme();
  const attachment = resolveBackendAssetUrl(pickAttachmentUrl(item.attachments?.[0]));

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}
      accessibilityRole="button"
      accessibilityLabel="Open broadcast detail"
    >
      <View style={styles.meta}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {item.title ?? 'Community update'}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.time, { color: palette.subtext }]}>{formatDate(item.broadcastedAt)}</Text>
          <View style={[styles.badge, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
            <Text style={[styles.badgeText, { color: palette.primaryStrong }]}>Feed</Text>
          </View>
        </View>
      </View>

      {item.body ? (
        <Text style={[styles.body, { color: palette.text }]} numberOfLines={3}>
          {item.body}
        </Text>
      ) : null}

      {attachment ? (
        <Image source={{ uri: attachment }} style={styles.image} resizeMode="cover" />
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onReact} style={styles.action}>
          <KISIcon name="heart" size={18} color={palette.primary} />
          <Text style={[styles.actionText, { color: palette.primary }]}>
            {item.engagement.reactions ?? 0}
          </Text>
        </Pressable>
        <View style={styles.action}>
          <KISIcon name="comment" size={18} color={palette.subtext} />
          <Text style={[styles.actionText, { color: palette.subtext }]}>
            {item.engagement.comments ?? 0}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  meta: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
  },
  badge: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: '#111',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 6,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
