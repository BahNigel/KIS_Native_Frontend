import React from 'react';
import { View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import Skeleton from '@/components/common/Skeleton';

type Props = {
  searchTerm?: string;
};

export default function BroadcastMarketPage(_props: Props) {
  const { palette } = useKISTheme();

  return (
    <View style={{ marginTop: 10, paddingHorizontal: 12, gap: 12 }}>
      <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18, padding: 14, backgroundColor: palette.surface }}>
        <Skeleton height={22} radius={10} />
        <Skeleton height={140} radius={18} />
      </View>

      <View style={{ borderWidth: 2, borderColor: palette.divider, borderRadius: 18, padding: 14, backgroundColor: palette.surface }}>
        <Skeleton height={18} radius={10} />
        <Skeleton height={90} radius={16} />
      </View>
    </View>
  );
}
