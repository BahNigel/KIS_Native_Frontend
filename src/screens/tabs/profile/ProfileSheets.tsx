import React from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  Image,
} from 'react-native';

import ImagePlaceholder from '@/components/common/ImagePlaceholder';
import { KISIcon } from '@/constants/kisIcons';

import { styles } from './profile.styles';
import { fieldLabels, visibilityOptions, walletModes, paymentProviders } from './profile.constants';
import { formatMoney } from './profile.utils';
import { ItemType } from './profile.types';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import UpgradeSheet from './profile/sheets/UpgradeSheet';

type Props = {
  palette: any;
  activeSheet: string | null;
  sheetY: Animated.Value;
  closeSheet: () => void;

  draftProfile: any;
  setDraftProfile: (fn: any) => void;
  pickImage: (kind: 'avatar' | 'cover') => void;
  saveProfile: () => void;

  draftPrivacy: Record<string, any>;
  setDraftPrivacy: (fn: any) => void;
  savePrivacy: () => void;

  draftItem: any;
  setDraftItem: (fn: any) => void;
  pickShowcaseFile: (type: ItemType) => Promise<any>;
  saveItem: () => void;

  profile: any;
  saving: boolean;

  walletForm: any;
  setWalletForm: (fn: any) => void;
  submitWalletAction: () => void;

  upgradeTier: (tierId: string) => void;
  billingHistory?: any;
  subscription?: any;
  cancelSubscription: (immediate?: boolean) => void;
  resumeSubscription: () => void;
  downgradeTier: (tierId: string) => void;
  retryTransaction: (txRef: string) => void;
};

export default function ProfileSheets(props: Props) {
  const {
    palette,
    activeSheet,
    sheetY,
    closeSheet,

    draftProfile,
    setDraftProfile,
    pickImage,
    saveProfile,

    draftPrivacy,
    setDraftPrivacy,
    savePrivacy,

    draftItem,
    setDraftItem,
    pickShowcaseFile,
    saveItem,

    profile,
    saving,

    walletForm,
    setWalletForm,
    submitWalletAction,

    upgradeTier,
    billingHistory,
    subscription,
    cancelSubscription,
    resumeSubscription,
    downgradeTier,
    retryTransaction,
  } = props;

  if (!activeSheet) return null;

  const accountTier = profile?.account?.tier;

  return (
    <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetY }] }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheet, { backgroundColor: palette.bg }]}
      >
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>
            {activeSheet === 'editProfile' && 'Edit Profile'}
            {activeSheet === 'privacy' && 'Privacy & Visibility'}
            {activeSheet === 'editItem' && 'Edit Item'}
            {activeSheet === 'upgrade' && 'Upgrade Account'}
            {activeSheet === 'wallet' && 'Wallet & Credits'}
          </Text>
          <Pressable onPress={closeSheet}>
            <KISIcon name="close" size={22} color={palette.subtext} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {activeSheet === 'editProfile' && (
            <View style={{ gap: 12 }}>
              <View style={styles.editMediaRow}>
                <Pressable onPress={() => pickImage('avatar')} style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}>
                  {draftProfile.avatar_preview ? (
                    <Image source={{ uri: draftProfile.avatar_preview }} style={styles.mediaPickImage} />
                  ) : (
                    <ImagePlaceholder size={52} radius={18} />
                  )}
                  <Text style={[styles.mediaPickLabel, { color: palette.text }]}>Change avatar</Text>
                </Pressable>

                <Pressable onPress={() => pickImage('cover')} style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}>
                  {draftProfile.cover_preview ? (
                    <Image source={{ uri: draftProfile.cover_preview }} style={styles.mediaPickImageWide} />
                  ) : (
                    <View style={styles.mediaWidePlaceholder}>
                      <ImagePlaceholder size={40} radius={14} />
                    </View>
                  )}
                  <Text style={[styles.mediaPickLabel, { color: palette.text }]}>Change cover</Text>
                </Pressable>
              </View>

              <KISTextInput
                label="Display name"
                value={draftProfile.display_name}
                onChangeText={(text) => setDraftProfile((s: any) => ({ ...s, display_name: text }))}
              />
              <KISTextInput
                label="Headline"
                value={draftProfile.headline}
                onChangeText={(text) => setDraftProfile((s: any) => ({ ...s, headline: text }))}
              />
              <KISTextInput
                label="Industry"
                value={draftProfile.industry}
                onChangeText={(text) => setDraftProfile((s: any) => ({ ...s, industry: text }))}
              />
              <KISTextInput
                label="Bio"
                value={draftProfile.bio}
                onChangeText={(text) => setDraftProfile((s: any) => ({ ...s, bio: text }))}
                multiline
                style={{ minHeight: 100 }}
              />
              <KISButton title={saving ? 'Saving...' : 'Save'} onPress={saveProfile} />
            </View>
          )}

          {activeSheet === 'privacy' && (
            <View style={{ gap: 16 }}>
              {Object.keys(fieldLabels).map((key) => {
                const rule = draftPrivacy[key] || { visibility: 'public', allow_user_ids: [] };
                const allowValue = Array.isArray(rule.allow_user_ids) ? rule.allow_user_ids.join(',') : '';

                return (
                  <View key={key} style={[styles.privacyRow, { borderColor: palette.divider }]}>
                    <Text style={[styles.privacyLabel, { color: palette.text }]}>{fieldLabels[key]}</Text>

                    <View style={styles.privacyOptions}>
                      {visibilityOptions.map((opt) => (
                        <Pressable
                          key={opt.value}
                          onPress={() =>
                            setDraftPrivacy((s: any) => ({
                              ...s,
                              [key]: { ...rule, field_key: key, visibility: opt.value },
                            }))
                          }
                          style={[
                            styles.privacyChip,
                            {
                              backgroundColor: rule.visibility === opt.value ? palette.primarySoft : palette.surface,
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
                          setDraftPrivacy((s: any) => ({
                            ...s,
                            [key]: {
                              ...rule,
                              field_key: key,
                              allow_user_ids: text.split(',').map((t) => t.trim()).filter(Boolean),
                            },
                          }))
                        }
                      />
                    )}
                  </View>
                );
              })}
              <KISButton title={saving ? 'Saving...' : 'Save'} onPress={savePrivacy} />
            </View>
          )}

          {activeSheet === 'editItem' && draftItem && (
            <EditItemSheet
              palette={palette}
              draftItem={draftItem}
              setDraftItem={setDraftItem}
              pickShowcaseFile={pickShowcaseFile}
              saveItem={saveItem}
              saving={saving}
            />
          )}

          {activeSheet === 'wallet' && (
            <View style={{ gap: 12 }}>
              <Text style={[styles.subtext, { color: palette.subtext }]}>
                Add money, convert to credits, or send gifts. $1 = 20 credits (USD only).
              </Text>

              <View style={styles.walletModeRow}>
                {walletModes.map((mode) => (
                  <Pressable
                    key={mode.value}
                    onPress={() => setWalletForm((s: any) => ({ ...s, mode: mode.value }))}
                    style={[
                      styles.walletModeChip,
                      {
                        backgroundColor: walletForm.mode === mode.value ? palette.primarySoft : palette.surface,
                        borderColor: palette.divider,
                      },
                    ]}
                  >
                    <Text style={{ color: palette.text, fontSize: 12 }}>{mode.label}</Text>
                  </Pressable>
                ))}
              </View>

              {walletForm.mode === 'deposit' && (
                <>
                  <View style={styles.walletModeRow}>
                    {paymentProviders.map((provider) => (
                      <Pressable
                        key={provider.value}
                        onPress={() => setWalletForm((s: any) => ({ ...s, provider: provider.value }))}
                        style={[
                          styles.walletModeChip,
                          {
                            backgroundColor: walletForm.provider === provider.value ? palette.primarySoft : palette.surface,
                            borderColor: palette.divider,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.text, fontSize: 12 }}>{provider.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.subtext, { color: palette.subtext }]}>
                    Flutterwave powers card + mobile money (MTN/Orange).
                  </Text>

                  <KISTextInput
                    label="Amount (USD)"
                    value={walletForm.amount}
                    onChangeText={(text) => setWalletForm((s: any) => ({ ...s, amount: text }))}
                    keyboardType="decimal-pad"
                  />
                </>
              )}

              {walletForm.mode === 'cash_to_credits' && (
                <KISTextInput
                  label="Amount to convert (USD)"
                  value={walletForm.amount}
                  onChangeText={(text) => setWalletForm((s: any) => ({ ...s, amount: text }))}
                  keyboardType="decimal-pad"
                />
              )}

              {walletForm.mode === 'credits_to_cash' && (
                <KISTextInput
                  label="Credits to convert"
                  value={walletForm.credits}
                  onChangeText={(text) => setWalletForm((s: any) => ({ ...s, credits: text }))}
                  keyboardType="number-pad"
                />
              )}

              {walletForm.mode === 'points_to_credits' && (
                <KISTextInput
                  label="Points to convert"
                  value={walletForm.points}
                  onChangeText={(text) => setWalletForm((s: any) => ({ ...s, points: text }))}
                  keyboardType="number-pad"
                />
              )}

              {walletForm.mode === 'transfer' && (
                <>
                  <KISTextInput
                    label="Recipient user ID"
                    value={walletForm.recipient}
                    onChangeText={(text) => setWalletForm((s: any) => ({ ...s, recipient: text }))}
                  />
                  <KISTextInput
                    label="Amount (USD)"
                    value={walletForm.amount}
                    onChangeText={(text) => setWalletForm((s: any) => ({ ...s, amount: text }))}
                    keyboardType="decimal-pad"
                  />
                  <KISTextInput
                    label="Or credits (optional)"
                    value={walletForm.credits}
                    onChangeText={(text) => setWalletForm((s: any) => ({ ...s, credits: text }))}
                    keyboardType="number-pad"
                  />
                </>
              )}

              {walletForm.mode === 'promo' && (
                <KISTextInput
                  label="Promo code"
                  value={walletForm.promo}
                  onChangeText={(text) => setWalletForm((s: any) => ({ ...s, promo: text.toUpperCase() }))}
                  autoCapitalize="characters"
                />
              )}

              <KISButton title={saving ? 'Working...' : 'Submit'} onPress={submitWalletAction} />
            </View>
          )}

          {activeSheet === 'upgrade' && (
            <UpgradeSheet
              tiers={profile?.tiers || []}
              accountTier={accountTier}
              saving={saving}
              onUpgrade={upgradeTier}
              subscription={subscription}
              billingHistory={billingHistory}
              usage={billingHistory?.usage || profile?.stats}
              onCancel={cancelSubscription}
              onResume={resumeSubscription}
              onDowngrade={downgradeTier}
              onRetry={retryTransaction}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

/** Kept separate so ProfileSheets stays <250 lines */
function EditItemSheet({
  palette,
  draftItem,
  setDraftItem,
  pickShowcaseFile,
  saveItem,
  saving,
}: any) {
  const t = draftItem.type;

  return (
    <View style={{ gap: 12 }}>
      {/* Keep the same fields; move more cases here if you want.
          If this grows too large, we can split EditItemSheet into its own file. */}

      {t === 'experience' && (
        <>
          <KISTextInput
            label="Title"
            value={draftItem.data.title || ''}
            onChangeText={(text) => setDraftItem((s: any) => ({ ...s, data: { ...s.data, title: text } }))}
          />
          <KISTextInput
            label="Description"
            value={draftItem.data.description || ''}
            onChangeText={(text) => setDraftItem((s: any) => ({ ...s, data: { ...s.data, description: text } }))}
            multiline
            style={{ minHeight: 90 }}
          />
        </>
      )}

      {['portfolio','case_study','testimonial','certification','intro_video','highlight'].includes(t) && (
        <>
          <KISTextInput
            label="Title"
            value={draftItem.data.title || ''}
            onChangeText={(text) => setDraftItem((s: any) => ({ ...s, data: { ...s.data, title: text } }))}
          />
          <Pressable
            onPress={async () => {
              const file = await pickShowcaseFile(t);
              if (file) setDraftItem((s: any) => ({ ...s, data: { ...s.data, file } }));
            }}
            style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
          >
            <Text style={[styles.mediaPickLabel, { color: palette.text }]}>
              {t === 'intro_video' ? 'Pick intro video' : 'Attach media'}
            </Text>
            {draftItem.data.file?.uri ? (
              <Text style={[styles.subtext, { color: palette.subtext }]} numberOfLines={1}>
                {draftItem.data.file.name}
              </Text>
            ) : null}
          </Pressable>
        </>
      )}

      <KISButton title={saving ? 'Saving...' : 'Save'} onPress={saveItem} />
    </View>
  );
}
