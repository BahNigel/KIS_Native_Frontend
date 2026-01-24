import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import CourseCard from '@/screens/broadcast/education/components/CourseCard';

type Course = {
  id: string;
  title?: string;
  subtitle?: string;
  price?: string | number;
  currency?: string;
  cover_url?: string | null;
};

type Props = {
  title?: string;
  items: Course[];
  onSeeAll?: () => void;
  onEnroll?: (courseId: string) => void;
};

export default function PopularCoursesSection({
  title = 'Popular Courses',
  items,
  onSeeAll,
  onEnroll,
}: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>{title}</Text>
        <Pressable onPress={onSeeAll}>
          <Text style={{ color: palette.subtext, fontWeight: '900' }}>See All ›</Text>
        </Pressable>
      </View>

      <View style={{ gap: 12 }}>
        {items.slice(0, 2).map((c) => {
          const price = c.price !== undefined && c.price !== null ? String(c.price) : '';
          const currency = c.currency ?? '';
          const priceLabel = price ? `Price ${currency ? `${currency} ` : ''}${price}` : '';

          return (
            <CourseCard
              key={c.id}
              title={c.title ?? 'Course'}
              subtitle={c.subtitle}
              priceLabel={priceLabel}
              coverUrl={c.cover_url ?? null}
              ctaLabel="Enroll"
              onPress={() => onEnroll?.(c.id)}
            />
          );
        })}
      </View>
    </View>
  );
}
