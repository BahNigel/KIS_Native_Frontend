// src/screens/tabs/profile/profile/sheets/UpgradeSheet.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
import { styles } from '../../profile.styles';
import { formatMoney } from '../../profile.utils';
import { tierMetaFor } from '../tierMeta';

export default function UpgradeSheet(props: {
  tiers: any[];
  accountTier: any;
  saving: boolean;
  onUpgrade: (tierId: string) => void;
}) {
  const { palette } = useKISTheme();
  const { tiers, accountTier, saving, onUpgrade } = props;

  const currentKey = String(accountTier?.id ?? accountTier?.name ?? '');

  return (
    <View style={{ gap: 12 }}>
      {tiers.map((tier: any) => {
        const meta = tierMetaFor(tier);
        const isCurrent = currentKey && currentKey === String(tier.id ?? tier.name ?? '');

        return (
          <Pressable
            key={tier.id ?? tier.name}
            onPress={() => onUpgrade(tier.id)}
            style={[
              styles.tierCard,
              {
                borderColor: palette.divider,
                backgroundColor: palette.card,
              },
            ]}
          >
            <View style={styles.tierHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tierTitle, { color: palette.text }]}>{tier.name}</Text>
                <Text style={[styles.tierTagline, { color: palette.subtext }]}>{meta.tagline}</Text>
              </View>

              {!!meta.badge && (
                <View style={[styles.tierBadge, { backgroundColor: palette.primarySoft }]}>
                  <Text style={[styles.tierBadgeText, { color: palette.primaryStrong }]}>{meta.badge}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.tierPrice, { color: palette.text }]}>
              ${formatMoney(tier.price_cents || 0)}/mo
            </Text>

            {!!meta.highlight && (
              <Text style={[styles.tierHighlight, { color: palette.primaryStrong }]}>{meta.highlight}</Text>
            )}

            <View style={styles.tierFeatures}>
              {meta.features.map((item: string) => (
                <View key={`${tier.id}-${item}`} style={styles.tierFeatureRow}>
                  <KISIcon name="check" size={14} color={palette.primaryStrong} />
                  <Text style={[styles.tierFeatureText, { color: palette.subtext }]}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.tierActionRow}>
              <KISButton
                title={isCurrent ? 'Current plan' : 'Choose plan'}
                variant={isCurrent ? 'outline' : 'primary'}
                onPress={() => onUpgrade(tier.id)}
                disabled={isCurrent || saving}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
