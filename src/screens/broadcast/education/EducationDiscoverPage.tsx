import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import useEducationData from '@/screens/broadcast/education/hooks/useEducationData';
import FeaturedLessonHero from '@/screens/broadcast/education/sections/FeaturedLessonHero';
import PopularCoursesSection from '@/screens/broadcast/education/sections/PopularCoursesSection';
import EducationCategoryPills from '@/screens/broadcast/education/components/EducationCategoryPills';

type Props = {
  searchTerm?: string;
};

export default function EducationDiscoverPage({ searchTerm = '' }: Props) {
  const { palette } = useKISTheme();
  const { home, loading, reload, enroll } = useEducationData({ q: searchTerm });

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const filteredPopular = useMemo(() => {
    const base = home.popular_courses ?? [];
    if (!activeCategoryId) return base;
    return base.filter((c: any) => String(c.category ?? '') === String(activeCategoryId));
  }, [home.popular_courses, activeCategoryId]);

  const featuredTitle = home.featured?.title ?? 'Postgraduate';
  const featuredSubtitle =
    home.featured?.subtitle ?? 'The Future of Artificial Intelligence';

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        {/* Featured education hero like the screenshot */}
        <FeaturedLessonHero
          title={featuredTitle}
          subtitle={featuredSubtitle}
          coverUrl={home.featured?.cover_url ?? null}
          badgeLeft={home.featured?.starts_at ? `Starts ${home.featured.starts_at}` : 'Live Sessions Coming'}
          badgeRight="Enroll"
          onPress={() => {}}
        />

        {/* Categories as pills (education tab feel) */}
        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Education</Text>
            <Text
              onPress={reload}
              style={{ color: palette.subtext, fontWeight: '900' }}
              suppressHighlighting
            >
              {loading ? 'Loading…' : 'Refresh'}
            </Text>
          </View>

          <EducationCategoryPills
            items={home.categories ?? []}
            activeId={activeCategoryId}
            onSelect={setActiveCategoryId}
          />
        </View>

        {/* Popular Courses block like screenshot bottom right */}
        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 22,
            padding: 12,
          }}
        >
          <PopularCoursesSection
            items={filteredPopular}
            onSeeAll={() => {}}
            onEnroll={async (courseId) => {
              await enroll(courseId);
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
