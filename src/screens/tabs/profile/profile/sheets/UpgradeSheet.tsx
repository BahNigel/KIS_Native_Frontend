// src/screens/tabs/profile/profile/sheets/UpgradeSheet.tsx
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISText from '@/components/common/KISText';
import { KISIcon } from '@/constants/kisIcons';
import { styles } from '../../profile.styles';
import { formatMoney } from '../../profile.utils';
import { tierMetaFor } from '../tierMeta';

const PARTNER_PRO_HIGHLIGHTS = [
  'Unlimited partner organizations, automation, and integrations',
  'Advanced partner analytics + compliance dashboards, exports, and access reviews',
  'Priority partner webhooks, automation rules, and fraud insights',
  'Partner-grade studio routing for broadcasts, lessons, and market drops',
];

export default function UpgradeSheet(props: {
  tiers: any[];
  accountTier: any;
  saving: boolean;
  onUpgrade: (tierId: string) => void;
  subscription?: any;
  billingHistory?: { transactions?: any[]; ledger?: any[] };
  usage?: Record<string, any>;
  onCancel?: (immediate?: boolean) => void;
  onResume?: () => void;
  onDowngrade?: (tierId: string) => void;
  onRetry?: (txRef: string) => void;
}) {
  const { palette } = useKISTheme();
  const {
    tiers,
    accountTier,
    saving,
    onUpgrade,
    subscription,
    billingHistory,
    usage,
    onCancel,
    onResume,
    onDowngrade,
    onRetry,
  } = props;

  const currentKey = String(accountTier?.id ?? accountTier?.name ?? '');
  const currentMeta = tierMetaFor(accountTier || {});
  const currentRank = currentMeta?.tierRank ?? 0;
  const partnerProTier = tiers.find((tier) => {
    const key = String(tier?.name ?? tier?.code ?? tier?.slug ?? '').toLowerCase();
    return key.includes('partner pro');
  });
  const transactions = billingHistory?.transactions ?? [];
  const tierLimits = accountTier?.features_json ?? {};

  const formatStorage = (valueMb: number | null) => {
    if (!valueMb || Number.isNaN(valueMb)) return '0 MB';
    if (valueMb >= 1024) return `${(valueMb / 1024).toFixed(1)} GB`;
    return `${Math.round(valueMb)} MB`;
  };

  console.log('Transactions:', transactions);

  const resolveUsage = (key: string, fallbackKeys: string[] = []) => {
    const direct = usage?.[key];
    if (direct !== undefined && direct !== null) return { value: direct, sourceKey: key };
    for (const alt of fallbackKeys) {
      const altVal = usage?.[alt];
      if (altVal !== undefined && altVal !== null) return { value: altVal, sourceKey: alt };
    }
    return { value: null, sourceKey: null };
  };

  const usageItems = [
    { label: 'Communities', usageKey: 'communities', limitKey: 'communities' },
    { label: 'Groups', usageKey: 'groups', limitKey: 'groups' },
    { label: 'Channels', usageKey: 'channels', limitKey: 'channels' },
    {
      label: 'Storage used',
      usageKey: 'storage_mb',
      usageAlt: ['storage_bytes', 'storage_used_mb'],
      limitKey: 'storage_gb',
      format: 'storage',
    },
  ];

  const usageRows = usageItems
    .map((item) => {
      const resolved = resolveUsage(item.usageKey, item.usageAlt || []);
      if (resolved.value === null || resolved.value === undefined) return null;
      let usageValue = resolved.value;
      if (item.format === 'storage' && resolved.sourceKey === 'storage_bytes') {
        usageValue = Number(usageValue) / (1024 * 1024);
      }
      return { ...item, usageValue };
    })
    .filter(Boolean) as Array<{
    label: string;
    usageValue: number;
    limitKey: string;
    format?: string;
  }>;

  const hasUsage = usageRows.length > 0;

  const grouped = tiers.reduce(
    (acc: Record<string, any[]>, tier: any) => {
      const meta = tierMetaFor(tier);
      const segment = meta.tierSegment || 'personal';
      if (!acc[segment]) acc[segment] = [];
      acc[segment].push(tier);
      return acc;
    },
    {},
  );

  const segmentOrder = ['personal', 'business', 'partner'];
  const segmentLabels: Record<string, string> = {
    personal: 'Personal plans',
    business: 'Business plans',
    partner: 'Partner plans',
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>
          Compare plans
        </Text>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>
          Pick a tier that fits your growth. Upgrades apply instantly after payment.
        </Text>
      </View>

      <View
        style={[
          styles.tierCard,
          { borderColor: palette.divider, backgroundColor: palette.card },
        ]}
      >
        <Text style={[styles.tierTitle, { color: palette.text }]}>Current plan</Text>
        <Text style={[styles.tierTagline, { color: palette.subtext }]}>
          {accountTier?.name || 'Free'} · {subscription?.status || 'active'}
        </Text>
        {subscription?.ends_at ? (
          <Text style={[styles.tierFeatureText, { color: palette.subtext, marginTop: 6 }]}>
            Renews on {new Date(subscription.ends_at).toLocaleDateString()}
          </Text>
        ) : null}
        {subscription?.cancel_at_period_end ? (
          <Text style={[styles.tierFeatureText, { color: palette.warning, marginTop: 6 }]}>
            Cancel scheduled — access ends {subscription?.ends_at ? new Date(subscription.ends_at).toLocaleDateString() : 'soon'}
          </Text>
        ) : null}
        {subscription?.pending_tier ? (
          <Text style={[styles.tierFeatureText, { color: palette.subtext, marginTop: 6 }]}>
            Downgrade queued to {subscription.pending_tier?.name || 'new tier'}
          </Text>
        ) : null}
        <View style={[styles.tierActionRow, { marginTop: 10 }]}>
          {subscription?.cancel_at_period_end ? (
            <KISButton
              title="Resume subscription"
              variant="primary"
              onPress={() => onResume?.()}
              disabled={saving}
            />
          ) : (
            <KISButton
              title="Cancel at period end"
              variant="outline"
              onPress={() => onCancel?.(false)}
              disabled={saving}
            />
          )}
          <KISButton
            title="Cancel now"
            variant="outline"
            onPress={() => onCancel?.(true)}
            disabled={saving}
          />
        </View>
      </View>

      {partnerProTier && (
        <View
          style={{
            borderWidth: 2,
            borderColor: palette.divider,
            borderRadius: 16,
            padding: 14,
            backgroundColor: palette.surface,
            gap: 8,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '700' }}>Partner Pro exclusive</Text>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>
            Partner Pro gives you unlimited partner orgs, automation, integrations, analytics, and compliance controls.
          </Text>
          <View style={{ gap: 4 }}>
            {PARTNER_PRO_HIGHLIGHTS.map((item) => (
              <Text key={item} style={{ color: palette.subtext, fontSize: 12 }}>
                • {item}
              </Text>
            ))}
          </View>
          <KISButton
            title="Upgrade to Partner Pro"
            variant="outline"
            onPress={() => partnerProTier?.id && onUpgrade(partnerProTier.id)}
            disabled={!partnerProTier?.id || saving}
          />
        </View>
      )}

      {hasUsage && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
            Current usage
          </Text>
          {usageRows.map((row) => {
            const limitRaw = tierLimits?.[row.limitKey];
            const hasLimit = limitRaw !== undefined && limitRaw !== null;
            const limitLabel =
              row.format === 'storage'
                ? hasLimit
                  ? formatStorage(Number(limitRaw) * 1024)
                  : 'Unlimited'
                : hasLimit
                ? String(limitRaw)
                : 'Unlimited';
            const usageLabel =
              row.format === 'storage'
                ? formatStorage(Number(row.usageValue))
                : String(row.usageValue);

            return (
              <View
                key={row.label}
                style={[
                  styles.tierFeatureRow,
                  {
                    justifyContent: 'space-between',
                    borderWidth: 2,
                    borderColor: palette.borderMuted,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  },
                ]}
              >
                <Text style={{ color: palette.subtext, fontSize: 12 }}>{row.label}</Text>
                <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>
                  {usageLabel} / {limitLabel}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {segmentOrder
        .filter((segment) => grouped[segment]?.length)
        .map((segment) => (
          <View key={segment} style={{ gap: 12 }}>
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '700' }}>
              {segmentLabels[segment] ?? segment}
            </Text>
            {grouped[segment].map((tier: any) => {
              const meta = tierMetaFor(tier);
              const isCurrent = currentKey && currentKey === String(tier.id ?? tier.name ?? '');
              const isUpgrade = meta.tierRank > currentRank;
              const isDowngrade = meta.tierRank < currentRank;
              const isLocked = !isCurrent && !isUpgrade && !isDowngrade;

              return (
                <Pressable
                  key={tier.id ?? tier.name}
                  onPress={() => {
                    if (isLocked) return;
                    if (isDowngrade) onDowngrade?.(tier.id);
                    else onUpgrade(tier.id);
                  }}
                  style={[
                    styles.tierCard,
                    {
                      borderColor: isLocked ? palette.borderMuted : palette.divider,
                      backgroundColor: palette.card,
                      opacity: isLocked ? 0.55 : 1,
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
                      title={
                        isCurrent
                          ? 'Current plan'
                          : isDowngrade
                          ? 'Schedule downgrade'
                          : isLocked
                          ? 'Not eligible'
                          : 'Choose plan'
                      }
                      variant={isCurrent || isLocked ? 'outline' : 'primary'}
                      onPress={() => {
                        if (isLocked || isCurrent) return;
                        if (isDowngrade) onDowngrade?.(tier.id);
                        else onUpgrade(tier.id);
                      }}
                      disabled={isCurrent || isLocked || saving}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <KISText preset="title" weight="700" style={{ color: palette.text }}>
            Billing history
          </KISText>
          {billingHistory?.invoice_pdf_url ? (
            <KISButton
              title="Download invoice"
              size="xs"
              variant="outline"
              left={<KISIcon name="document" size={14} color={palette.text} />}
              onPress={() => Linking.openURL(billingHistory.invoice_pdf_url as string)}
            />
          ) : null}
        </View>
        {transactions.length === 0 ? (
          <KISText preset="helper" color={palette.subtext}>
            No billing activity yet.
          </KISText>
        ) : (
          transactions.slice(0, 6).map((tx: any) => (
            <View
              key={tx.tx_ref || tx.id}
              style={[
                styles.tierFeatureRow,
                {
                  justifyContent: 'space-between',
                  borderWidth: 2,
                  borderColor: palette.borderMuted,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <KISText preset="body" weight="700" style={{ color: palette.text }}>
                  {tx.meta?.intent === 'tier_upgrade' ? 'Upgrade payment' : tx.kind || 'Payment'}
                </KISText>
                <KISText preset="helper" color={palette.subtext}>
                  {tx.status || 'pending'} · ${formatMoney(tx.amount_cents || 0)}
                </KISText>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {tx.receipt_pdf_url ? (
                  <KISButton
                    title="Receipt"
                    size="xs"
                    variant="outline"
                    onPress={() => Linking.openURL(tx.receipt_pdf_url)}
                  />
                ) : tx.receipt_url ? (
                  <KISButton
                    title="Receipt"
                    size="xs"
                    variant="outline"
                    onPress={() => Linking.openURL(tx.receipt_url)}
                  />
                ) : null}
                {tx.status === 'failed' ? (
                  <KISButton
                    title="Retry"
                    size="xs"
                    variant="ghost"
                    onPress={() => onRetry?.(tx.tx_ref)}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
