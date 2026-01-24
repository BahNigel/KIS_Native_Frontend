import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import BroadcastHeaderBar from '@/components/broadcast/BroadcastHeaderBar';
import BroadcastMainTabs, { type BroadcastMainTabId } from '@/components/broadcast/BroadcastMainTabs';
import BroadcastSearchRow, { type BroadcastSubTabId } from '@/components/broadcast/BroadcastSearchRow';
import BroadcastFeedsPage from '../broadcast/pages/BroadcastFeedsPage';
import BroadcastEducationPage from '../broadcast/pages/BroadcastEducationPage';
import BroadcastMarketPage from '../broadcast/pages/BroadcastMarketPage';
import BroadcastHealthcarePage from '../broadcast/pages/BroadcastHealthcarePage';


export default function BroadcastScreen() {
  const { palette } = useKISTheme();

  const [activeMainTab, setActiveMainTab] = useState<BroadcastMainTabId>('feeds');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<BroadcastSubTabId>('search');

  const subTabs = useMemo(() => {
    if (activeMainTab === 'feeds') {
      return [
        { id: 'search' as const, label: 'Search', icon: 'search' },
        { id: 'codes' as const, label: 'Codes', icon: 'tag' },
        { id: 'filter' as const, label: 'Filter', icon: 'filter' },
      ];
    }
    if (activeMainTab === 'education') {
      return [
        { id: 'search' as const, label: 'Search', icon: 'search' },
        { id: 'courses' as const, label: 'Courses', icon: 'book' },
        { id: 'filter' as const, label: 'Filter', icon: 'filter' },
      ];
    }
    if (activeMainTab === 'market') {
      return [
        { id: 'search' as const, label: 'Search', icon: 'search' },
        { id: 'channels' as const, label: 'Channels', icon: 'hash' },
        { id: 'communities' as const, label: 'Communities', icon: 'users' },
      ];
    }
    return [
      { id: 'search' as const, label: 'Search', icon: 'search' },
      { id: 'topics' as const, label: 'Topics', icon: 'list' },
      { id: 'filter' as const, label: 'Filter', icon: 'filter' },
    ];
  }, [activeMainTab]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 10 }}>
          <BroadcastHeaderBar
            title="Broadcast"
            tierLabel="Business Pro"
            onCreate={() => {}}
          />

          <BroadcastMainTabs value={activeMainTab} onChange={setActiveMainTab} />

          <BroadcastSearchRow
            value={activeSubTab}
            onChange={setActiveSubTab}
            tabs={subTabs}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </View>

        {activeMainTab === 'feeds' && <BroadcastFeedsPage searchTerm={searchTerm} />}
        {activeMainTab === 'education' && <BroadcastEducationPage searchTerm={searchTerm} />}
        {activeMainTab === 'market' && <BroadcastMarketPage searchTerm={searchTerm} />}
        {activeMainTab === 'healthcare' && <BroadcastHealthcarePage searchTerm={searchTerm} />}
      </ScrollView>
    </View>
  );
}
