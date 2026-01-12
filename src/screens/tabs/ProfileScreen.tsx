// src/screens/tabs/profile/ProfileScreen.tsx
import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import Skeleton from '@/components/common/Skeleton';
import PartnerCreateSlide from '@/components/partners/CreatePartnerScreen';
import { KISIcon } from '@/constants/kisIcons';
import { useAuth } from '../../../App';

import { styles } from './profile/profile.styles';
import { useProfileController } from './profile/useProfileController';
import { formatMoney } from './profile/profile.utils';
import UpgradeSheet from './profile/profile/sheets/UpgradeSheet';
import { fieldLabels, visibilityOptions, walletModes, paymentProviders } from './profile/profile.constants';

import HeroHeader from './profile/components/HeroHeader';
import AccountCreditsCard from './profile/components/AccountCreditsCard';
import SectionCard from './profile/components/SectionCard';
import { isPartnerTier } from '@/services/tierAccess';

import BottomSheet from './profile/sheets/BottomSheet';
import SheetHeader from './profile/sheets/SheetHeader';

export default function ProfileScreen() {
  const { palette } = useKISTheme();
  const { setAuth, setPhone } = useAuth();

  const c = useProfileController({ setAuth, setPhone });

  const accountTier = c.profile?.account?.tier;
  const walletBalance = c.profile?.account?.wallet_balance_cents ?? 0;
  const credits = c.profile?.account?.credits ?? 0;
  const creditsValue = c.profile?.account?.credits_value_cents ?? 0;
  const points = c.profile?.account?.points ?? 0;
  const currentTier = accountTier || c.profile?.tier || c.profile?.subscription?.tier;
  const showCreatePartnerButton = isPartnerTier(currentTier);

  const sheetTitle = useMemo(() => {
    if (c.activeSheet === 'editProfile') return 'Edit Profile';
    if (c.activeSheet === 'privacy') return 'Privacy & Visibility';
    if (c.activeSheet === 'editItem') return 'Edit Item';
    if (c.activeSheet === 'upgrade') return 'Upgrade Account';
    return 'Wallet & Credits';
  }, [c.activeSheet]);

  const openWalletSheet = c.openSheet;
  const setWalletForm = c.setWalletForm;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('wallet.open', (payload: any) => {
      openWalletSheet('wallet');
      setWalletForm((prev: any) => ({
        ...prev,
        mode: payload?.mode ?? prev.mode,
        amount: payload?.amount ? String(payload.amount) : prev.amount,
        credits: payload?.credits ? String(payload.credits) : prev.credits,
        points: payload?.points ? String(payload.points) : prev.points,
      }));
    });
    return () => sub.remove();
  }, [openWalletSheet, setWalletForm]);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {c.loading ? (
          <View style={{ gap: 16 }}>
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <Skeleton height={160} radius={18} />
              <View style={{ marginTop: 16, gap: 10 }}>
                <Skeleton height={18} width={200} />
                <Skeleton height={12} width={160} />
                <Skeleton height={12} width={220} />
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <Skeleton height={18} width={180} />
              <View style={{ marginTop: 14, gap: 10 }}>
                <Skeleton height={46} radius={12} />
                <Skeleton height={46} radius={12} />
                <Skeleton height={46} radius={12} />
              </View>
            </View>
          </View>
        ) : !c.profile ? (
          <View style={[styles.card, { backgroundColor: palette.card }]}>
            <Text style={[styles.title, { color: palette.text }]}>Profile not available</Text>
            <Text style={[styles.subtext, { color: palette.subtext, marginTop: 6 }]}>
              Pull to refresh or try again.
            </Text>
            <View style={{ marginTop: 12 }}>
              <KISButton title="Retry" onPress={c.loadProfile} />
            </View>
          </View>
        ) : (
          <>
            {/* HERO (matches mock) */}
            <HeroHeader
              coverUrl={c.profile.profile?.cover_url}
              avatarUrl={c.profile.profile?.avatar_url}
              displayName={c.profile.user?.display_name || 'Your name'}
              handle={`@${(c.profile.user?.display_name || 'user')
                .toLowerCase()
                .replace(/\s+/g, '')}`}
              headline={c.profile.profile?.headline || 'Add a headline that sells you'}
              tierName={accountTier?.name || 'Free'}
              completion={c.profile.profile?.completion_score ?? 0}
              onEdit={c.openEditProfile}
            />

            {/* OVERVIEW */}
            <View style={[styles.card, { backgroundColor: palette.card }]}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: palette.text }]}>Profile Overview</Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  {c.profile.profile?.industry || 'Industry not set'}
                </Text>
              </View>

              <Text style={{ fontSize: 14, lineHeight: 20, color: palette.text }}>
                {c.profile.profile?.bio || 'Add a short bio that explains your work.'}
              </Text>

              <View style={styles.actionRow}>
                <KISButton title="Edit Profile" onPress={c.openEditProfile} />
                <KISButton
                  title="Privacy"
                  variant="outline"
                  onPress={() => c.openSheet('privacy')}
                />
              </View>
            </View>

            {/* ACCOUNT / WALLET / UPGRADE */}
            <AccountCreditsCard
              tierName={accountTier?.name || 'Free'}
              tierPriceCents={accountTier?.price_cents || 0}
              walletBalanceCents={walletBalance}
              credits={credits}
              creditsValueCents={creditsValue}
              points={points}
              onWallet={() => c.openSheet('wallet')}
              onUpgrade={() => c.openSheet('upgrade')}
              showCreatePartnerButton={showCreatePartnerButton}
              onCreatePartner={c.openCreatePartner}
              walletLedger={c.walletLedger}
            />

            {/* IMPACT */}
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.divider },
              ]}
            >
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: palette.text }]}>Impact Snapshot</Text>
                <Text style={[styles.subtext, { color: palette.subtext }]}>Quick analytics</Text>
              </View>

              <View style={styles.statRow}>
                {[
                  { label: 'Articles', value: c.profile.sections?.articles?.length || 0 },
                  { label: 'Projects', value: c.profile.sections?.projects?.length || 0 },
                  {
                    label: 'Testimonials',
                    value: c.profile.sections?.showcases?.testimonial?.length || 0,
                  },
                  { label: 'Activity', value: c.profile.sections?.activity?.length || 0 },
                ].map((it) => (
                  <View
                    key={it.label}
                    style={[styles.statChip, { backgroundColor: palette.surfaceElevated }]}
                  >
                    <Text style={[styles.statValue, { color: palette.text }]}>{it.value}</Text>
                    <Text style={[styles.statLabel, { color: palette.subtext }]}>{it.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ALL SECTIONS */}
            {c.sectionList.map((section) => (
              <SectionCard
                key={section.key}
                title={section.title}
                type={section.key as any}
                items={section.items}
                onAdd={() => c.openItemEditor(section.key as any)}
                onEdit={(item) => c.openItemEditor(section.key as any, item)}
                onDelete={(id) => c.deleteItem(section.key as any, id)}
              />
            ))}

            {/* LOGOUT */}
            <View style={{ gap: 12 }}>
              <KISButton title="Log Out" onPress={c.logout} variant="outline" />
            </View>
          </>
        )}
      </ScrollView>

      {/* Partner slide */}
      {c.showCreatePartner && (
        <Animated.View
          style={[
            styles.slideContainer,
            { backgroundColor: palette.bg, transform: [{ translateX: c.slideX }] },
          ]}
        >
          <PartnerCreateSlide onClose={c.closeCreatePartner} />
        </Animated.View>
      )}

      {/* Bottom Sheet host */}
      {c.activeSheet && (
        <BottomSheet sheetY={c.sheetY} onBackdropPress={c.closeSheet}>
          <SheetHeader title={sheetTitle} onClose={c.closeSheet} />

          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* =========================
                EDIT PROFILE
               ========================= */}
            {c.activeSheet === 'editProfile' && (
              <View style={{ gap: 12 }}>
                <View style={styles.editMediaRow}>
                  <Pressable
                    onPress={() => c.pickImage('avatar')}
                    style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
                  >
                    {c.draftProfile?.avatar_preview ? (
                      <Image
                        source={{ uri: c.draftProfile.avatar_preview }}
                        style={styles.mediaPickImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.mediaPickImage,
                          {
                            backgroundColor: palette.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <KISIcon name="user" size={18} color={palette.subtext} />
                      </View>
                    )}
                    <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
                      Change avatar
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => c.pickImage('cover')}
                    style={[styles.mediaPickCard, { backgroundColor: palette.surface, flex: 1 }]}
                  >
                    {c.draftProfile?.cover_preview ? (
                      <Image
                        source={{ uri: c.draftProfile.cover_preview }}
                        style={styles.mediaPickImageWide}
                      />
                    ) : (
                      <View
                        style={[
                          styles.mediaPickImageWide,
                          {
                            backgroundColor: palette.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <KISIcon name="image" size={18} color={palette.subtext} />
                      </View>
                    )}
                    <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
                      Change cover
                    </Text>
                  </Pressable>
                </View>

                <KISTextInput
                  label="Display name"
                  value={c.draftProfile.display_name}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, display_name: t }))}
                />
                <KISTextInput
                  label="Headline"
                  value={c.draftProfile.headline}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, headline: t }))}
                />
                <KISTextInput
                  label="Industry"
                  value={c.draftProfile.industry}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, industry: t }))}
                />
                <KISTextInput
                  label="Bio"
                  value={c.draftProfile.bio}
                  onChangeText={(t) => c.setDraftProfile((s: any) => ({ ...s, bio: t }))}
                  multiline
                  style={{ minHeight: 110 }}
                />

                <KISButton
                  title={c.saving ? 'Saving...' : 'Save'}
                  onPress={c.saveProfile}
                  disabled={c.saving}
                />
              </View>
            )}

            {/* =========================
                PRIVACY
               ========================= */}
            {c.activeSheet === 'privacy' && (
              <View style={{ gap: 16 }}>
                {Object.keys(fieldLabels).map((key) => {
                  const rule = c.draftPrivacy?.[key] || { visibility: 'public', allow_user_ids: [] };
                  const allowValue = Array.isArray(rule.allow_user_ids) ? rule.allow_user_ids.join(',') : '';
                  return (
                    <View key={key} style={[styles.privacyRow, { borderColor: palette.divider }]}>
                      <Text style={[styles.privacyLabel, { color: palette.text }]}>{fieldLabels[key]}</Text>

                      <View style={styles.privacyOptions}>
                        {visibilityOptions.map((opt) => (
                          <Pressable
                            key={opt.value}
                            onPress={() =>
                              c.setDraftPrivacy((s: any) => ({
                                ...s,
                                [key]: { ...rule, field_key: key, visibility: opt.value },
                              }))
                            }
                            style={[
                              styles.privacyChip,
                              {
                                backgroundColor:
                                  rule.visibility === opt.value ? palette.primarySoft : palette.surface,
                                borderColor: palette.divider,
                              },
                            ]}
                          >
                            <Text style={{ color: palette.text, fontSize: 12 }}>{opt.label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      {(rule.visibility === 'custom' || rule.visibility === 'contacts') && (
                        <KISTextInput
                          label="Allowed user IDs (comma separated)"
                          value={allowValue}
                          onChangeText={(text) =>
                            c.setDraftPrivacy((s: any) => ({
                              ...s,
                              [key]: {
                                ...rule,
                                field_key: key,
                                allow_user_ids: text
                                  .split(',')
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              },
                            }))
                          }
                        />
                      )}
                    </View>
                  );
                })}

                <KISButton title={c.saving ? 'Saving...' : 'Save'} onPress={c.savePrivacy} disabled={c.saving} />
              </View>
            )}

            {/* =========================
                EDIT ITEM
               ========================= */}
            {c.activeSheet === 'editItem' && c.draftItem && (
              <View style={{ gap: 12 }}>
                <KISTextInput
                  label="Title / Name"
                  value={c.draftItem.data.title || c.draftItem.data.name || ''}
                  onChangeText={(t) =>
                    c.setDraftItem((s: any) => ({
                      ...s,
                      data: {
                        ...s.data,
                        title: s.data.title != null ? t : s.data.title,
                        name: s.data.name != null ? t : s.data.name,
                      },
                    }))
                  }
                />

                <KISTextInput
                  label="Description / Summary"
                  value={c.draftItem.data.description || c.draftItem.data.summary || ''}
                  onChangeText={(t) =>
                    c.setDraftItem((s: any) => ({
                      ...s,
                      data: { ...s.data, description: t, summary: t },
                    }))
                  }
                  multiline
                  style={{ minHeight: 100 }}
                />

                {typeof c.pickShowcaseFile === 'function' && (
                  <Pressable
                    onPress={async () => {
                      const file = await c.pickShowcaseFile(c.draftItem.type);
                      if (file) c.setDraftItem((s: any) => ({ ...s, data: { ...s.data, file } }));
                    }}
                    style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
                  >
                    <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
                      Attach media (optional)
                    </Text>
                    {c.draftItem.data.file?.name ? (
                      <Text style={[styles.subtext, { color: palette.subtext }]} numberOfLines={1}>
                        {c.draftItem.data.file.name}
                      </Text>
                    ) : null}
                  </Pressable>
                )}

                <KISButton title={c.saving ? 'Saving...' : 'Save'} onPress={c.saveItem} disabled={c.saving} />
              </View>
            )}

            {/* =========================
                WALLET
               ========================= */}
            {c.activeSheet === 'wallet' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.subtext, { color: palette.subtext }]}>
                  Add money, convert to credits, or send gifts. $1 = 20 credits (USD only).
                </Text>

                <View style={styles.walletModeRow}>
                  {walletModes.map((mode) => (
                    <Pressable
                      key={mode.value}
                      onPress={() => c.setWalletForm((s: any) => ({ ...s, mode: mode.value }))}
                      style={[
                        styles.walletModeChip,
                        {
                          backgroundColor: c.walletForm.mode === mode.value ? palette.primarySoft : palette.surface,
                          borderColor: palette.divider,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontSize: 12 }}>{mode.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {c.walletForm.mode === 'deposit' && (
                  <>
                    <View style={styles.walletModeRow}>
                      {paymentProviders.map((provider) => (
                        <Pressable
                          key={provider.value}
                          onPress={() => c.setWalletForm((s: any) => ({ ...s, provider: provider.value }))}
                          style={[
                            styles.walletModeChip,
                            {
                              backgroundColor: c.walletForm.provider === provider.value ? palette.primarySoft : palette.surface,
                              borderColor: palette.divider,
                            },
                          ]}
                        >
                          <Text style={{ color: palette.text, fontSize: 12 }}>{provider.label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <KISTextInput
                      label="Amount (USD)"
                      value={c.walletForm.amount}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, amount: t }))}
                      keyboardType="decimal-pad"
                    />
                  </>
                )}

                {c.walletForm.mode === 'cash_to_credits' && (
                  <KISTextInput
                    label="Amount to convert (USD)"
                    value={c.walletForm.amount}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, amount: t }))}
                    keyboardType="decimal-pad"
                  />
                )}

                {c.walletForm.mode === 'credits_to_cash' && (
                  <KISTextInput
                    label="Credits to convert"
                    value={c.walletForm.credits}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, credits: t }))}
                    keyboardType="number-pad"
                  />
                )}

                {c.walletForm.mode === 'points_to_credits' && (
                  <KISTextInput
                    label="Points to convert"
                    value={c.walletForm.points}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, points: t }))}
                    keyboardType="number-pad"
                  />
                )}

                {c.walletForm.mode === 'transfer' && (
                  <>
                    <KISTextInput
                      label="Recipient phone number with country code"
                      value={c.walletForm.recipient}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, recipient: t }))}
                    />
                    <KISTextInput
                      label="Amount (USD)"
                      value={c.walletForm.amount}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, amount: t }))}
                      keyboardType="decimal-pad"
                    />
                    <KISTextInput
                      label="Or credits (optional)"
                      value={c.walletForm.credits}
                      onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, credits: t }))}
                      keyboardType="number-pad"
                    />
                  </>
                )}

                {c.walletForm.mode === 'promo' && (
                  <KISTextInput
                    label="Promo code"
                    value={c.walletForm.promo}
                    onChangeText={(t) => c.setWalletForm((s: any) => ({ ...s, promo: t.toUpperCase() }))}
                    autoCapitalize="characters"
                  />
                )}

                <KISButton
                  title={c.saving ? 'Working...' : 'Submit'}
                  onPress={async () => {
                    await c.submitWalletAction?.();
                    const paymentUrl = c.lastWalletPaymentUrl;
                    if (paymentUrl) Linking.openURL(paymentUrl);
                  }}
                  disabled={c.saving}
                />
              </View>
            )}

            {/* =========================
                UPGRADE (UPDATED)
               ========================= */}
            {c.activeSheet === 'upgrade' && (
              <UpgradeSheet
                tiers={c.profile?.tiers || []}
                accountTier={accountTier}
                saving={c.saving}
                onUpgrade={c.upgradeTier}
                subscription={c.billingHistory?.subscription ?? c.profile?.subscription}
                billingHistory={c.billingHistory}
                usage={c.billingHistory?.usage || c.profile?.stats}
                onCancel={c.cancelSubscription}
                onResume={c.resumeSubscription}
                onDowngrade={c.downgradeTier}
                onRetry={c.retryTransaction}
              />
            )}
          </ScrollView>
        </BottomSheet>
      )}
    </View>
  );
}
