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

const buildTrendingItems = (items: BroadcastFeedItem[]): TrendingClipItem[] => {
  const sorted = [...items].sort((a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0));
  return sorted.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title ?? item.source?.name ?? 'Broadcast',
    body: item.text_plain ?? item.text ?? '',
    broadcastedAt: item.broadcasted_at ?? item.created_at ?? undefined,
    attachments: item.attachments ?? [],
    engagement: {
      reactions: item.reaction_count ?? 0,
      comments: item.comment_count ?? 0,
    },
  }));
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

    const nextItems = page.results ?? [];
    setItems(nextItems);
    setTrending(buildTrendingItems(nextItems));
    nextUrlRef.current = page.next ?? null;
    setLoading(false);
  }, [code, q]);

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
      for (const it of page.results ?? []) {
        if (!have.has(it.id)) merged.push(it);
      }
      if (!mountedRef.current) return prev;
      setTrending(buildTrendingItems(merged));
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
    loading,
    loadingMore,
    refreshing,
    refreshAll,
    loadMore,
    toggleSubscribe,
  };
}
