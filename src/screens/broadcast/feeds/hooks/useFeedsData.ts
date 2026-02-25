import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

import { FEEDS_ENDPOINT } from '@/screens/broadcast/feeds/api/feeds.endpoints';
import {
  BroadcastFeedItem,
  BroadcastSourceMeta,
  TrendingClipItem,
  normalizePaginated,
} from '@/screens/broadcast/feeds/api/feeds.types';

type Params = {
  q?: string;
  code?: string | null;
};

const buildQuery = (params: Record<string, any>) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    qs.set(k, s);
  });
  const out = qs.toString();
  return out ? `?${out}` : '';
};

const toTrendingClipItem = (item: BroadcastFeedItem): TrendingClipItem => ({
  id: item.id,
  title: item.title ?? item.source?.name ?? 'Broadcast',
  body: item.text_plain ?? item.text ?? '',
  broadcastedAt: item.broadcasted_at ?? item.created_at ?? undefined,
  attachments: item.attachments ?? [],
  engagement: {
    reactions: item.reaction_count ?? 0,
    comments: item.comment_count ?? 0,
  },
});

const getTopTrendingFeeds = (items: BroadcastFeedItem[], limit = 20) => {
  return [...items]
    .sort((a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0))
    .slice(0, limit);
};

const isHealthcareFeedItem = (item: BroadcastFeedItem | null | undefined) => {
  if (!item) return false;
  const sourceType = String(item.source_type ?? '').toLowerCase();
  const sourceMetaType = String(item.source?.type ?? '').toLowerCase();
  return sourceType === 'healthcare' || sourceMetaType === 'healthcare';
};

const mapProfileFeedToBroadcastItem = (entry: any): BroadcastFeedItem => {
  const attachments = ([] as any[])
    .concat(entry.attachment ? [entry.attachment] : [])
    .concat(Array.isArray(entry.attachments) ? entry.attachments : [])
    .filter(Boolean);

  const timestamp = entry.created_at ?? entry.updated_at ?? new Date().toISOString();

  return {
    id: `profile-${entry.id}`,
    source_type: 'broadcast_profile',
    source_id: String(entry.id),
    title: entry.title,
    text: entry.summary,
    text_plain: entry.summary,
    broadcasted_at: timestamp,
    created_at: timestamp,
    attachments,
    reaction_count: entry.reaction_count ?? 0,
    comment_count: entry.comment_count ?? 0,
    source: {
      type: 'broadcast_profile',
      id: 'main',
      name: 'My broadcast feed',
      is_subscribed: true,
      allow_subscribe: false,
      can_open: true,
    },
  };
};

export default function useFeedsData({ q = '', code = null }: Params) {
  const [items, setItems] = useState<BroadcastFeedItem[]>([]);
  const [trending, setTrending] = useState<TrendingClipItem[]>([]);
  const [trendingFeeds, setTrendingFeeds] = useState<BroadcastFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const nextUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const paramsKey = useMemo(() => `${q}::${code ?? ''}`, [q, code]);

  const fetchProfileFeeds = useCallback(async () => {
    try {
      const res = await getRequest(ROUTES.broadcasts.list, {
        errorMessage: 'Unable to load broadcast profiles.',
      });
      if (!res?.success) return [];
      const profile = res.data?.profiles?.broadcast_feed;
      const feeds = Array.isArray(profile?.feeds) ? profile.feeds : [];
      return feeds.map(mapProfileFeedToBroadcastItem);
    } catch (error) {
      console.warn('[useFeedsData] profile feeds failed', error);
      return [];
    }
  }, []);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const url = `${FEEDS_ENDPOINT}${buildQuery({ q, code })}`;
    try {
      const [res, profileFeeds] = await Promise.all([
        getRequest(url, { errorMessage: 'Unable to load feeds.' }),
        fetchProfileFeeds(),
      ]);
      if (!mountedRef.current) return;
      const payload = res?.data ?? res;
      const page = normalizePaginated<BroadcastFeedItem>(payload);
      const nonHealthcareResults = (page.results ?? []).filter((item) => !isHealthcareFeedItem(item));
      const nextItems = [...profileFeeds, ...nonHealthcareResults];
      setItems(nextItems);
      const topTrending = getTopTrendingFeeds(nextItems);
      setTrendingFeeds(topTrending);
      setTrending(topTrending.map(toTrendingClipItem));
      nextUrlRef.current = page.next ?? null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [code, fetchProfileFeeds, q]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    if (!mountedRef.current) return;
    setRefreshing(false);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    const nextUrl = nextUrlRef.current;
    if (!nextUrl || loadingMore) return;

    setLoadingMore(true);
    const res = await getRequest(nextUrl, { errorMessage: 'Unable to load more.' });
    const payload = res?.data ?? res;
    const page = normalizePaginated<BroadcastFeedItem>(payload);
    if (!mountedRef.current) {
      setLoadingMore(false);
      return;
    }

    setItems((prev) => {
      const have = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      const nonHealthcareResults = (page.results ?? []).filter((item) => !isHealthcareFeedItem(item));
      for (const it of nonHealthcareResults) {
        if (!have.has(it.id)) merged.push(it);
      }
      if (!mountedRef.current) return prev;
      const topTrending = getTopTrendingFeeds(merged);
      setTrendingFeeds(topTrending);
      setTrending(topTrending.map(toTrendingClipItem));
      return merged;
    });

    nextUrlRef.current = page.next ?? null;
    setLoadingMore(false);
  }, [loadingMore]);

  const toggleSubscribe = useCallback(
    async (source: BroadcastSourceMeta | undefined, currentlySubscribed: boolean) => {
      if (!source?.id || !source.allow_subscribe) {
        return { ok: false };
      }

      const targetType = String(source.type ?? '').toLowerCase();
      if (!['partner', 'community', 'channel'].includes(targetType)) {
        return { ok: false };
      }

      if (currentlySubscribed) {
        setItems((prev) =>
          prev.map((it) => {
            if (!it.source?.id || String(it.source.id) !== String(source.id)) return it;
            return {
              ...it,
              source: {
                ...it.source,
                is_subscribed: false,
              },
            };
          }),
        );
        return { ok: true };
      }

      const payload: Record<string, any> = {
        target_type: targetType,
        target_id: source.id,
      };
      if (targetType === 'channel' && source.conversation_id) {
        payload.conversation_id = source.conversation_id;
      }

      const res = await postRequest(
        ROUTES.broadcasts.subscribe,
        payload,
        { errorMessage: 'Unable to update subscription.' },
      );
      if (res?.success === false) return { ok: false };

      setItems((prev) =>
        prev.map((it) => {
          if (!it.source?.id || String(it.source.id) !== String(source.id)) return it;
          if (String(it.source.type) !== targetType) return it;
          return {
            ...it,
            source: {
              ...it.source,
              is_subscribed: true,
            },
          };
        }),
      );

      DeviceEventEmitter.emit('broadcast.refresh');
      return { ok: true };
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    refreshAll();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', () => {
      refreshAll();
    });
    return () => sub.remove();
  }, [refreshAll]);

  return {
    items,
    trending,
    trendingFeeds,
    loading,
    loadingMore,
    refreshing,
    refreshAll,
    loadMore,
    toggleSubscribe,
  };
}
