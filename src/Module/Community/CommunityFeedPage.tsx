import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { KISIcon } from '@/constants/kisIcons';
import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import Skeleton from '@/components/common/Skeleton';

type Community = {
  id: string;
  name: string;
};

type Post = {
  id: string;
  text?: string;
  created_at?: string;
  author?: { display_name?: string };
};

type FeedItem =
  | { type: 'post'; data: Post }
  | { type: 'ad'; id: string };

type CommunityFeedPageProps = {
  community: Community;
  onBack: () => void;
};

export default function CommunityFeedPage({
  community,
  onBack,
}: CommunityFeedPageProps) {
  const { palette } = useKISTheme();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRequest(`${ROUTES.community.posts}?community=${community.id}`, {
        errorMessage: 'Failed to load posts',
      });
      const list = res?.data ?? res ?? [];
      setPosts(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [community.id]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    posts.forEach((p, idx) => {
      items.push({ type: 'post', data: p });
      if ((idx + 1) % 3 === 0) {
        items.push({ type: 'ad', id: `ad-${idx}` });
      }
    });
    return items;
  }, [posts]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider, backgroundColor: palette.card }]}>
        <Pressable onPress={onBack} style={styles.headerButton}>
          <KISIcon name="arrow-left" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {community.name} Feed
        </Text>
      </View>

      <View style={styles.feedHeader}>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>Community Feed</Text>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <View
              key={`feed-skel-${idx}`}
              style={[styles.postCard, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}
            >
              <View style={styles.postHeader}>
                <Skeleton width={36} height={36} radius={18} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="50%" height={12} radius={6} />
                  <Skeleton width="30%" height={10} radius={6} style={{ marginTop: 6 }} />
                </View>
              </View>
              <Skeleton width="100%" height={12} radius={6} style={{ marginTop: 10 }} />
              <Skeleton width="80%" height={12} radius={6} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item, idx) => (item.type === 'post' ? item.data.id : item.id ?? String(idx))}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => {
            if (item.type === 'ad') {
              return (
                <View style={[styles.adCard, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Sponsored</Text>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600', marginTop: 6 }}>
                    Promote your ministry or product here
                  </Text>
                  <Text style={{ color: palette.subtext, marginTop: 6 }}>
                    Reach engaged community members with native ads.
                  </Text>
                </View>
              );
            }
            const post = item.data;
            return (
              <View style={[styles.postCard, { borderColor: palette.inputBorder, backgroundColor: palette.card }]}>
                <View style={styles.postHeader}>
                  <ImagePlaceholder size={36} radius={18} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>
                      {post.author?.display_name ?? 'Member'}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {post.created_at ? new Date(post.created_at).toLocaleString() : 'Just now'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: palette.text, marginTop: 10 }}>
                  {post.text ?? ''}
                </Text>
                <View style={styles.postActions}>
                  <Pressable style={styles.actionPill}>
                    <KISIcon name="heart" size={14} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, marginLeft: 6 }}>Like</Text>
                  </Pressable>
                  <Pressable style={styles.actionPill}>
                    <KISIcon name="comment" size={14} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, marginLeft: 6 }}>Comment</Text>
                  </Pressable>
                  <Pressable style={styles.actionPill}>
                    <KISIcon name="share" size={14} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, marginLeft: 6 }}>Share</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: palette.subtext }}>No posts yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  feedHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  postCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  postActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  adCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
});
