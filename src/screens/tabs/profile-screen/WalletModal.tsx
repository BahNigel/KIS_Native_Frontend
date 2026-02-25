import React from 'react';
import { Pressable, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { paymentProviders, walletModes } from '../profile/profile.constants';

import { styles } from '../profile/profile.styles';

type WalletModalProps = {
  palette: KISPalette;
  walletForm: Record<string, any>;
  setWalletForm: React.Dispatch<React.SetStateAction<any>>;
  saving: boolean;
  submitWalletAction?: () => Promise<void>;
  lastWalletPaymentUrl?: string;
};

export function WalletModal(props: WalletModalProps) {
  const { palette, walletForm, setWalletForm, saving, submitWalletAction, lastWalletPaymentUrl } = props;

  const handleSubmit = async () => {
    await submitWalletAction?.();
    if (lastWalletPaymentUrl) return;
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.subtext, { color: palette.subtext }]}>
        Manage your KIS Coin wallet. 1 KISC = $100 USD.
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

      {walletForm.mode === 'add_kisc' && (
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

          <KISTextInput
            label="Amount (KISC)"
            value={walletForm.amount}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, amount: t }))}
            keyboardType="decimal-pad"
          />
          <KISTextInput
            label="Reference (optional)"
            value={walletForm.reference}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, reference: t }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {walletForm.mode === 'spend_kisc' && (
        <>
          <KISTextInput
            label="Amount (KISC)"
            value={walletForm.amount}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, amount: t }))}
            keyboardType="decimal-pad"
          />
          <KISTextInput
            label="Reference (optional)"
            value={walletForm.reference}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, reference: t }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {walletForm.mode === 'transfer' && (
        <>
          <KISTextInput
            label="Recipient phone number"
            value={walletForm.recipient}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, recipient: t }))}
          />
          <KISTextInput
            label="Amount (KISC)"
            value={walletForm.amount}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, amount: t }))}
            keyboardType="decimal-pad"
          />
          <KISTextInput
            label="Reference (optional)"
            value={walletForm.reference}
            onChangeText={(t) => setWalletForm((s: any) => ({ ...s, reference: t }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      <KISButton title={saving ? 'Working...' : 'Submit'} onPress={handleSubmit} disabled={saving} />
    </View>
  );
}
