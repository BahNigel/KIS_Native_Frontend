import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import FeedsMainListSection from '@/screens/broadcast/feeds/sections/FeedsMainListSection';
import TrendingClipsSection from '@/screens/broadcast/feeds/sections/TrendingClipsSection';
import PromoEducationCard from '@/screens/broadcast/feeds/components/PromoEducationCard';

import useFeedsData from '@/screens/broadcast/feeds/hooks/useFeedsData';

type Props = {
  searchTerm?: string;
  code?: string | null;
};

export default function FeedsDiscoverPage({ searchTerm = '', code = null }: Props) {
  const { palette } = useKISTheme();

  const {
    items,
    trending,
    loading,
    loadingMore,
    refreshAll,
    loadMore,
    toggleSubscribe,
  } = useFeedsData({ q: searchTerm, code });

  const filteredFeed = useMemo(() => {
    // backend already filters by q, but keep safety for local quick filtering
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay =
        `${it.title ?? ''} ${it.text_plain ?? ''} ${it.source?.name ?? ''} ${it.author?.display_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchTerm]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 120 }}
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const pad = 220;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - pad) {
          loadMore();
        }
      }}
      scrollEventThrottle={16}
    >
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        <FeedsMainListSection
          items={filteredFeed}
          loading={loading}
          loadingMore={loadingMore}
          onRefresh={refreshAll}
          onOpenItem={() => {}}
          onShare={() => {}}
          onLike={() => {}}
          onSubscribe={async (sourceId, isSubscribed) => {
            await toggleSubscribe(sourceId, isSubscribed);
          }}
        />

        <TrendingClipsSection
          items={trending}
          onSeeAll={() => {}}
          onOpen={() => {}}
          onReact={() => {}}
        />

        <PromoEducationCard
          title="Postgraduate"
          subtitle="The Future of Artificial Intelligence"
          footerLeft="Live Sessions Start May 21st"
          ctaLabel="Enroll"
          onPress={() => {}}
          backgroundColor={palette.surface}
        />
      </View>
    </ScrollView>
  );
}
