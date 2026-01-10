import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type BroadcastSourceMeta = {
  type: 'community' | 'partner' | 'channel' | 'market' | string;
  id?: string | null;
  name?: string;
  conversation_id?: string;
  join_policy?: string;
  is_member?: boolean;
  allow_apply?: boolean;
  allow_subscribe?: boolean;
  auto_approve?: boolean;
  methods?: string[];
  is_subscribed?: boolean;
  can_open?: boolean;
};

export type BroadcastFeedItem = {
  id: string;
  source_type: string;
  title?: string;
  text?: string;
  styled_text?: { text?: string } | null;
  attachments?: any[];
  author?: { display_name?: string };
  created_at?: string;
  broadcasted_at?: string;
  reaction_count?: number;
  viewer_reaction?: string | null;
  comment_count?: number;
  source?: BroadcastSourceMeta;
  product?: {
    name?: string;
    description?: string;
    price?: string;
    currency?: string;
  };
};

type Props = {
  item: BroadcastFeedItem;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onOpenSource?: () => void;
  onJoinSource?: () => void;
  onSubscribeChannel?: () => void;
  onOpenMarket?: () => void;
};

const fallbackAvatar = require('@/assets/logo-light.png');

export default function BroadcastFeedCard({
  item,
  onLike,
  onComment,
  onShare,
  onOpenSource,
  onJoinSource,
  onSubscribeChannel,
  onOpenMarket,
}: Props) {
  const { palette } = useKISTheme();
  const body = item.text || item.styled_text?.text || item.product?.description || '';
  const attachment = Array.isArray(item.attachments) ? item.attachments[0] : null;
  const attachmentUrl =
    (typeof attachment === 'string' ? attachment : null) ??
    attachment?.url ??
    attachment?.uri ??
    attachment?.file_url ??
    attachment?.fileUrl ??
    attachment?.path ??
    null;
  const thumbUrl =
    attachment?.thumbUrl ??
    attachment?.thumb_url ??
    attachment?.thumbnail ??
    attachment?.thumb ??
    attachment?.preview_url ??
    attachment?.previewUrl ??
    null;
  const kind = attachment?.kind ?? attachment?.mimeType ?? attachment?.type ?? '';
  const isVideo = String(kind).includes('video') || String(kind).includes('mp4');
  const source = item.source;
  const showOpen = source?.can_open;
  const isChannel = source?.type === 'channel';
  const showJoin = !source?.can_open && (source?.type === 'community' || source?.type === 'partner');
  const showSubscribe = isChannel && !source?.is_subscribed;
  const showMarket = source?.type === 'market';

  return (
    <View style={[styles.card, { borderColor: palette.divider, backgroundColor: palette.card }]}>
      <View style={styles.header}>
        <Image source={fallbackAvatar} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>
            {item.title || source?.name || 'Broadcast'}
          </Text>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            {item.broadcasted_at
              ? new Date(item.broadcasted_at).toLocaleString()
              : item.created_at
              ? new Date(item.created_at).toLocaleString()
              : 'Just now'}
          </Text>
        </View>
      </View>

      {attachmentUrl ? (
        <View style={styles.mediaWrap}>
          {isVideo ? (
            <>
              {thumbUrl ? (
                <Image source={{ uri: thumbUrl }} style={styles.media} />
              ) : (
                <View style={[styles.media, styles.mediaFallback, { borderColor: palette.divider }]}>
                  <KISIcon name="play" size={22} color={palette.subtext} />
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                    Video attachment
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Image source={{ uri: attachmentUrl }} style={styles.media} />
          )}
        </View>
      ) : null}

      {body ? (
        <Text style={{ color: palette.text, marginTop: 10, fontSize: 14, lineHeight: 20 }}>
          {body}
        </Text>
      ) : null}

      {item.product ? (
        <View style={[styles.productChip, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>{item.product.name}</Text>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            {item.product.price} {item.product.currency}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onLike} style={styles.actionPill}>
          <KISIcon
            name="heart"
            size={16}
            color={item.viewer_reaction ? palette.primary : palette.subtext}
            focused={Boolean(item.viewer_reaction)}
          />
          <Text style={{ color: palette.subtext }}>
            {item.reaction_count ?? 0}
          </Text>
        </Pressable>
        <Pressable onPress={onComment} style={styles.actionPill}>
          <KISIcon name="comment" size={16} color={palette.subtext} />
          <Text style={{ color: palette.subtext }}>{item.comment_count ?? 0}</Text>
        </Pressable>
        <Pressable onPress={onShare} style={styles.actionPill}>
          <KISIcon name="share" size={16} color={palette.subtext} />
          <Text style={{ color: palette.subtext }}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.ctaRow}>
        {showSubscribe ? (
          <KISButton title="Follow channel" size="sm" onPress={onSubscribeChannel} />
        ) : null}
        {showJoin ? (
          <KISButton title="Join" size="sm" variant="outline" onPress={onJoinSource} />
        ) : null}
        {showOpen ? (
          <KISButton title="Open source" size="sm" variant="secondary" onPress={onOpenSource} />
        ) : null}
        {showMarket ? (
          <KISButton title="View store" size="sm" variant="secondary" onPress={onOpenMarket} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  mediaWrap: { marginTop: 6 },
  media: { width: '100%', height: 180, borderRadius: 12 },
  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  actionPill: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  ctaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  productChip: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
});
