import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import KISTextInput from '@/constants/KISTextInput';

export type BroadcastSubTabId =
  | 'search'
  | 'codes'
  | 'filter'
  | 'channels'
  | 'communities'
  | 'courses'
  | 'topics';

type Tab = {
  id: BroadcastSubTabId;
  label: string;
  icon: string;
};

type Props = {
  tabs: Tab[];
  value: BroadcastSubTabId;
  onChange: (next: BroadcastSubTabId) => void;
  searchValue: string;
  onSearchChange: (next: string) => void;
};

export default function BroadcastSearchRow({
  tabs,
  value,
  onChange,
  searchValue,
  onSearchChange,
}: Props) {
  const { palette, tokens } = useKISTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.tabsRow, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: active ? palette.primarySoft : 'transparent',
                  borderColor: active ? palette.primary : 'transparent',
                },
              ]}
            >
              <KISIcon name={t.icon as any} size={14} color={active ? palette.primaryStrong : palette.subtext} />
              <Text style={{ color: active ? palette.primaryStrong : palette.subtext, fontWeight: '900' }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.searchWrap, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
        <View style={styles.searchIcon}>
          <KISIcon name="search" size={16} color={palette.subtext} />
        </View>
        <View style={{ flex: 1 }}>
          <KISTextInput
            label=""
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder="Search"
            style={{
              borderWidth: 0,
              paddingHorizontal: 0,
              paddingVertical: 0,
              backgroundColor: 'transparent',
            }}
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (_tokens: any) =>
  StyleSheet.create({
    tabsRow: {
      borderWidth: 2,
      borderRadius: 18,
      padding: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tabBtn: {
      flex: 1,
      borderWidth: 2,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    searchWrap: {
      borderWidth: 2,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    searchIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
