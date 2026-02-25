import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KISButton from '@/constants/KISButton';
import { useKISTheme } from '@/theme/useTheme';
import { styles } from '../profile.styles';

const MICROS_PER_KISC = 100000;

const toKisc = (micro?: number) => {
  const safe = Number.isFinite(Number(micro)) ? Number(micro) : 0;
  return (safe / MICROS_PER_KISC).toFixed(3);
};

const toUsd = (micro?: number) => {
  const safe = Number.isFinite(Number(micro)) ? Number(micro) : 0;
  return ((safe / MICROS_PER_KISC) * 100).toFixed(2);
};

const toEntryAmount = (entry: any) => {
  const amountMicro = Number(entry?.amount_micro);
  if (Number.isFinite(amountMicro) && amountMicro !== 0) {
    const sign = String(entry?.transaction_type || '').toLowerCase() === 'debit' ? '-' : '+';
    return `${sign}${toKisc(Math.abs(amountMicro))} KISC`;
  }
  const amountCents = Number(entry?.amount_cents);
  if (Number.isFinite(amountCents) && amountCents !== 0) {
    const usd = Math.abs(amountCents) / 100;
    const sign = amountCents < 0 ? '-' : '+';
    return `${sign}$${usd.toFixed(2)}`;
  }
  return '0.000 KISC';
};

export default function AccountCreditsCard({
  tierName,
  tierPriceCents,
  kisBalanceMicro,
  kisBalanceKisc,
  kisBalanceUsd,
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
  kisBalanceMicro: number;
  kisBalanceKisc?: string;
  kisBalanceUsd?: string;
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
  const [showHistory, setShowHistory] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulseAnim]);

  const partnerLimitText = partnerProfilesIsUnlimited
    ? 'Unlimited partner orgs'
    : partnerProfilesLimitLabel ?? (partnerProfilesLimitValue ?? 0).toString();

  const resolvedKisc = useMemo(
    () => (kisBalanceKisc && kisBalanceKisc.trim() ? kisBalanceKisc : toKisc(kisBalanceMicro)),
    [kisBalanceKisc, kisBalanceMicro],
  );
  const resolvedUsd = useMemo(
    () => (kisBalanceUsd && kisBalanceUsd.trim() ? kisBalanceUsd : toUsd(kisBalanceMicro)),
    [kisBalanceMicro, kisBalanceUsd],
  );

  return (
    <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.divider }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Account & KIS-Coins</Text>
        <Text style={[styles.subtext, { color: palette.subtext }]}>${(tierPriceCents / 100).toFixed(2)}/mo</Text>
      </View>

      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: `${palette.accentPrimary}33`,
          backgroundColor: palette.surfaceElevated,
          padding: 14,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['rgba(255,221,87,0.16)', 'rgba(255,255,255,0.02)', 'rgba(255,173,51,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />

        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 120, alignItems: 'center' }}>
            <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 114,
                  height: 114,
                  borderRadius: 57,
                  borderWidth: 2,
                  borderColor: '#F8D26A66',
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      }),
                    },
                  ],
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.65, 0.2],
                  }),
                }}
              />
              <LinearGradient
                colors={['#FCE28A', '#DFA735', '#B87416']}
                start={{ x: 0.1, y: 0.1 }}
                end={{ x: 0.9, y: 0.9 }}
                style={{
                  width: 98,
                  height: 98,
                  borderRadius: 49,
                  borderWidth: 2,
                  borderColor: '#F9E9A3',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#DFA735',
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 5,
                }}
              >
                <View
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 41,
                    borderWidth: 1,
                    borderColor: '#FAE89D99',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#D19127AA',
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF9E7' }}>KIS</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFF9E7', marginTop: 3 }}>
                    {resolvedKisc}
                  </Text>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFF4D1', marginTop: 4, textAlign: 'center' }}>
                    Health Access Trust Care
                  </Text>
                </View>
              </LinearGradient>
            </View>
            <Text style={[styles.statMeta, { color: palette.subtext, marginTop: 6 }]}>${resolvedUsd} USD</Text>
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>KIS Coin Balance</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{resolvedKisc} KISC</Text>
            <Text style={[styles.statMeta, { color: palette.subtext }]}>USD Equivalent: ${resolvedUsd}</Text>
            <Text style={[styles.statMeta, { color: palette.subtext }]}>
              1 KISC = $100.00
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: palette.subtext }]}>Wallet Micro Units</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>{Math.max(0, Number(kisBalanceMicro || 0))}</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}>
          <Text style={[styles.statLabel, { color: palette.subtext }]}>Points</Text>
          <Text style={[styles.statValue, { color: palette.text }]}>{points}</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <KISButton title="Add KIS Coins" variant="secondary" onPress={onWallet} />
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
        <TouchableOpacity onPress={() => setShowHistory((prev) => !prev)}>
          <Text style={[styles.title, { color: palette.text, fontSize: 16 }]}>
            Transaction History {showHistory ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {!showHistory ? null : walletLedger.length === 0 ? (
          <Text style={[styles.subtext, { color: palette.subtext }]}>No recent KIS wallet activity.</Text>
        ) : (
          walletLedger.slice(0, 6).map((entry: any) => (
            <View key={entry.id} style={[styles.itemRow, { borderBottomColor: palette.divider }]}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>
                  {String(entry.transaction_type || entry.kind || 'entry').replace(/_/g, ' ')}
                </Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  {toEntryAmount(entry)}
                  {entry.reference ? ` • ${entry.reference}` : ''}
                </Text>
              </View>
              <Text style={[styles.subtext, { color: palette.subtext }]}>
                {new Date(entry.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
