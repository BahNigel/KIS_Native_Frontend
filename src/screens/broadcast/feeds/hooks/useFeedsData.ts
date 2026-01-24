import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

import {
  FEEDS_ENDPOINT,
  FEEDS_TRENDING_ENDPOINT,
  SUBSCRIBE_ENDPOINT,
  UNSUBSCRIBE_ENDPOINT,
} from '@/screens/broadcast/feeds/api/feeds.endpoints';

import {
  BroadcastFeedItem,
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

export default function useFeedsData({ q = '', code = null }: Params) {
  const [items, setItems] = useState<BroadcastFeedItem[]>([]);
  const [trending, setTrending] = useState<TrendingClipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const nextUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const paramsKey = useMemo(() => `${q}::${code ?? ''}`, [q, code]);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const url = `${FEEDS_ENDPOINT}${buildQuery({ q, code })}`;

    const res = await getRequest(url, { errorMessage: 'Unable to load feeds.' });
    const payload = res?.data ?? res;

    const page = normalizePaginated<BroadcastFeedItem>(payload);
    if (!mountedRef.current) return;

    setItems(page.results ?? []);
    nextUrlRef.current = page.next ?? null;
    setLoading(false);
  }, [q, code]);

  const loadTrending = useCallback(async () => {
    const url = `${FEEDS_TRENDING_ENDPOINT}${buildQuery({ q, code })}`;
    const res = await getRequest(url, { errorMessage: 'Unable to load trending.' });
    const payload = res?.data ?? res;

    const page = normalizePaginated<any>(payload);
    if (!mountedRef.current) return;

    // normalize to TrendingClipItem-like for FeedItemCard
    const mapped: TrendingClipItem[] = (page.results ?? []).map((x: any) => ({
      id: String(x.id ?? x.pk ?? Math.random()),
      title: x.title ?? x.source?.name ?? 'Trending',
      body: x.body ?? x.text_plain ?? x.text ?? '',
      broadcastedAt: x.broadcasted_at ?? x.created_at ?? x.broadcastedAt,
      attachments: x.attachments ?? [],
      engagement: {
        reactions: x.reaction_count ?? x.engagement?.reactions ?? 0,
        comments: x.comment_count ?? x.engagement?.comments ?? 0,
      },
    }));

    setTrending(mapped);
  }, [q, code]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFirstPage(), loadTrending()]);
    if (!mountedRef.current) return;
    setRefreshing(false);
  }, [loadFirstPage, loadTrending]);

  const loadMore = useCallback(async () => {
    const nextUrl = nextUrlRef.current;
    if (!nextUrl || loadingMore) return;

    setLoadingMore(true);
    const res = await getRequest(nextUrl, { errorMessage: 'Unable to load more.' });
    const payload = res?.data ?? res;

    const page = normalizePaginated<BroadcastFeedItem>(payload);
    if (!mountedRef.current) return;

    setItems((prev) => {
      const have = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      for (const it of page.results ?? []) {
        if (!have.has(it.id)) merged.push(it);
      }
      return merged;
    });

    nextUrlRef.current = page.next ?? null;
    setLoadingMore(false);
  }, [loadingMore]);

  const toggleSubscribe = useCallback(async (sourceId: string, currentlySubscribed: boolean) => {
    const url = currentlySubscribed ? UNSUBSCRIBE_ENDPOINT(sourceId) : SUBSCRIBE_ENDPOINT(sourceId);
    const res = await postRequest(url, {}, { errorMessage: 'Unable to update subscription.' });
    if (res?.success === false) return { ok: false };

    // optimistic update for the cards
    setItems((prev) =>
      prev.map((it) => {
        if (!it.source?.id) return it;
        if (String(it.source.id) !== String(sourceId)) return it;
        return {
          ...it,
          source: {
            ...it.source,
            is_subscribed: !currentlySubscribed,
          },
        };
      }),
    );

    DeviceEventEmitter.emit('broadcast.refresh');
    return { ok: true };
  }, []);

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
    loading,
    loadingMore,
    refreshing,
    refreshAll,
    loadMore,
    toggleSubscribe,
  };
}
