import React from 'react';
import { View } from 'react-native';
import FeedsDiscoverPage from '@/screens/broadcast/feeds/FeedsDiscoverPage';

type Props = {
  searchTerm?: string;
};

export default function BroadcastFeedsPage({ searchTerm = '' }: Props) {
  return (
    <View style={{ marginTop: 10 }}>
      <FeedsDiscoverPage searchTerm={searchTerm} />
    </View>
  );
}
