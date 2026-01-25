import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

import BroadcastHeaderBar from '@/components/broadcast/BroadcastHeaderBar';
import BroadcastMainTabs, { type BroadcastMainTabId } from '@/components/broadcast/BroadcastMainTabs';
import BroadcastSearchRow from '@/components/broadcast/BroadcastSearchRow';
import BroadcastFeedsPage from '../broadcast/pages/BroadcastFeedsPage';
import BroadcastEducationPage from '../broadcast/pages/BroadcastEducationPage';
import BroadcastMarketPage from '../broadcast/pages/BroadcastMarketPage';
import BroadcastHealthcarePage from '../broadcast/pages/BroadcastHealthcarePage';

const FILTER_OPTIONS: Record<BroadcastMainTabId, string[]> = {
  feeds: ['Latest', 'Trending', 'Saved'],
  education: ['Courses', 'Lessons', 'Workshops'],
  market: ['Products', 'Shops', 'Drops'],
  healthcare: ['Providers', 'Services', 'Wellness'],
};

const SEARCH_PLACEHOLDERS: Record<BroadcastMainTabId, string> = {
  feeds: 'Search broadcast feeds',
  education: 'Search courses & lessons',
  market: 'Search marketplace drops',
  healthcare: 'Search providers & services',
};


export default function BroadcastScreen() {
  const { palette } = useKISTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [activeMainTab, setActiveMainTab] = useState<BroadcastMainTabId>('feeds');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<BroadcastMainTabId, string>>(() =>
    (Object.keys(FILTER_OPTIONS) as BroadcastMainTabId[]).reduce((acc, key) => {
      acc[key] = FILTER_OPTIONS[key][0];
      return acc;
    }, {} as Record<BroadcastMainTabId, string>),
  );

  const handleFilterSelect = (option: string) => {
    setSelectedFilters((prev) => ({ ...prev, [activeMainTab]: option }));
  };

  const currentFilter = selectedFilters[activeMainTab];
  const showFilterPanel = filterVisible && FILTER_OPTIONS[activeMainTab]?.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: palette.bg }}
      >
        <View style={styles.headerContainer}>
          <View style={styles.headerSection}>
            <BroadcastHeaderBar title="Broadcast" tierLabel="Business Pro" onCreate={() => {}} />
          </View>
          <View style={styles.headerSection}>
            <BroadcastMainTabs value={activeMainTab} onChange={setActiveMainTab} />
          </View>
          <View style={styles.headerSection}>
            <BroadcastSearchRow
              searchPlaceholder={SEARCH_PLACEHOLDERS[activeMainTab]}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              onFilterPress={() => setFilterVisible((prev) => !prev)}
              filterLabel={`Filter (${currentFilter})`}
              filterActive={filterVisible}
            />
          </View>
          {showFilterPanel ? (
            <View style={[styles.headerSection, styles.filterPanel]}>
              {FILTER_OPTIONS[activeMainTab].map((option) => (
                <Pressable
                  key={option}
                  onPress={() => handleFilterSelect(option)}
                  style={[
                    styles.filterOption,
                    {
                      borderColor: option === currentFilter ? palette.primary : palette.divider,
                      backgroundColor: option === currentFilter ? palette.primarySoft : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: option === currentFilter ? palette.primaryStrong : palette.text }}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 12 }}>
          {activeMainTab === 'feeds' && (
            <BroadcastFeedsPage
              searchTerm={searchTerm}
              searchContext={currentFilter}
              onTrendingSeeAll={() => {
                handleFilterSelect('Trending');
                setFilterVisible(false);
              }}
            />
          )}
          {activeMainTab === 'education' && (
            <BroadcastEducationPage searchTerm={searchTerm} searchContext={currentFilter} />
          )}
          {activeMainTab === 'market' && (
            <BroadcastMarketPage searchTerm={searchTerm} searchContext={currentFilter} />
          )}
          {activeMainTab === 'healthcare' && (
            <BroadcastHealthcarePage searchTerm={searchTerm} searchContext={currentFilter} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (palette: ReturnType<typeof useKISTheme>['palette']) =>
  StyleSheet.create({
    headerContainer: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 16,
      backgroundColor: palette.bg,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    headerSection: {
      marginBottom: 12,
    },
    filterPanel: {
      borderWidth: 2,
      borderRadius: 18,
      borderColor: palette.divider,
      padding: 10,
      backgroundColor: palette.surface,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    filterOption: {
      borderWidth: 2,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 8,
      marginBottom: 8,
    },
  });
