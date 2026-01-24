// src/screens/tabs/profile/components/AccountCreditsCard.tsx
import React from 'react';
import { Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import { formatMoney } from '../profile.utils';
import { useKISTheme } from '@/theme/useTheme';
import { styles } from '../profile.styles';

export default function AccountCreditsCard({
  tierName,
  tierPriceCents,
  walletBalanceCents,
  credits,
  creditsValueCents,
  points,
  onWallet,
  onUpgrade,
  walletLedger,
  showCreatePartnerButton,
  onCreatePartner,
  partnerProfilesCount,
  partnerProfilesLimitLabel,
  partnerProfilesLimitValue,
  partnerProfilesIsUnlimited,
}: {
  tierName: string;
  tierPriceCents: number;
  walletBalanceCents: number;
  credits: number;
  creditsValueCents: number;
  points: number;
  onWallet: () => void;
  onUpgrade: () => void;
  walletLedger: any[];
  showCreatePartnerButton?: boolean;
  onCreatePartner?: () => void;
  partnerProfilesCount?: number;
  partnerProfilesLimitLabel?: string | null;
  partnerProfilesLimitValue?: number | null;
  partnerProfilesIsUnlimited?: boolean;
}) {
  const { palette } = useKISTheme();
  const partnerLimitText = partnerProfilesIsUnlimited
    ? 'Unlimited partner orgs'
    : partnerProfilesLimitLabel ?? (partnerProfilesLimitValue ?? 0).toString();

  return (
    <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Account & Credits</Text>
        <Text style={[styles.subtext, { color: palette.subtext }]}>${formatMoney(tierPriceCents)}/mo</Text>
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: palette.subtext }]}>Wallet</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>${formatMoney(walletBalanceCents)}</Text>
        </View>

        <View style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: palette.subtext }]}>Credits</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>{credits}</Text>
          <Text style={[styles.statMeta, { color: palette.subtext }]}>${formatMoney(creditsValueCents)} value</Text>
        </View>

        <View style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: palette.subtext }]}>Points</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>{points}</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <KISButton title="Wallet Actions" variant="secondary" onPress={onWallet} />
        <KISButton title={`Upgrade Account (${tierName})`} variant="outline" onPress={onUpgrade} style={{ borderColor: palette.border, borderWidth: 3 }} />
        {showCreatePartnerButton && onCreatePartner ? (
          <KISButton title="Create partner" variant="primary" onPress={onCreatePartner} />
        ) : null}
      </View>

      <View style={[styles.partnerRow, { justifyContent: 'space-between' }]}>
        <Text style={[styles.subtext, { color: palette.text }]}>Partner orgs</Text>
        <Text style={[styles.statMeta, { color: palette.subtext }]}>
          {partnerProfilesCount ?? 0}/{partnerLimitText}
        </Text>
      </View>

      <View style={{ marginTop: 10, gap: 8 }}>
        <Text style={[styles.title, { color: palette.text, fontSize: 16 }]}>Recent Wallet Activity</Text>
        {walletLedger.length === 0 ? (
          <Text style={[styles.subtext, { color: palette.subtext }]}>No recent activity.</Text>
        ) : (
          walletLedger.slice(0, 4).map((entry: any) => (
            <View key={entry.id} style={[styles.itemRow, { borderBottomColor: palette.divider }]}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>{entry.kind?.replace(/_/g, ' ') || 'Entry'}</Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  {entry.credits_delta ? `${entry.credits_delta} credits` : `$${formatMoney(entry.amount_cents || 0)}`}
                </Text>
              </View>
              <Text style={[styles.subtext, { color: palette.subtext }]}>{new Date(entry.created_at).toLocaleDateString()}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
