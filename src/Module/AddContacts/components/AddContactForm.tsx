// src/screens/chat/components/AddContactForm.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';

import { KISIcon } from '@/constants/kisIcons';
import { KIS_TOKENS } from '../../../theme/constants';
import { addContactsStyles as styles } from '../addContactsStyles';

type AddContactFormProps = {
  palette: any;
  onSubmit: (payload: {
    name: string;
    phone: string;
    countryCode: string;
  }) => Promise<void> | void;
};

export const AddContactForm: React.FC<AddContactFormProps> = ({
  palette,
  onSubmit,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+237');
  const [label, setLabel] = useState('Mobile');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSave =
    fullName.trim().length > 0 &&
    phone.trim().length > 0 &&
    !submitting;

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Please enter a name');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter a phone number');
      return;
    }
    setError(null);

    setSubmitting(true);
    try {
      await onSubmit({
        name: fullName,
        phone,
        countryCode,
      });
      Alert.alert(
        'Contact saved',
        `Name: ${fullName}\nPhone: ${countryCode} ${phone}\nLabel: ${label}`,
      );
      setFullName('');
      setPhone('');
    } catch (e) {
      console.warn('Save contact error', e);
      setError('Could not save contact.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <Text
        style={{
          color: palette.subtext,
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        Add a new contact. It will be saved to your device and cached in KIS.
      </Text>

      {/* Name */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: palette.subtext }]}>Name</Text>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: palette.card,
              borderColor: palette.inputBorder,
            },
          ]}
        >
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text }]}
          />
        </View>
      </View>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: palette.subtext }]}>Phone</Text>
        <View style={styles.phoneRow}>
          <Pressable
            onPress={() => {
              Alert.alert(
                'Country picker',
                'Implement real country picker later. Using +237 for now.',
              );
            }}
            style={[
              styles.countryPicker,
              {
                backgroundColor: palette.card,
                borderColor: palette.inputBorder,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 15 }}>
              {countryCode}
            </Text>
          </Pressable>
          <View
            style={[
              styles.phoneInputWrapper,
              {
                backgroundColor: palette.card,
                borderColor: palette.inputBorder,
              },
            ]}
          >
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Phone number"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text }]}
            />
          </View>
        </View>

        {/* Label */}
        <View style={styles.labelRow}>
          <Text style={[styles.labelSmall, { color: palette.subtext }]}>
            Label
          </Text>
          <Pressable
            onPress={() => {
              setLabel((prev) => {
                if (prev === 'Mobile') return 'Work';
                if (prev === 'Work') return 'Home';
                return 'Mobile';
              });
            }}
            style={[
              styles.labelPill,
              {
                backgroundColor: palette.surface,
                borderColor: palette.inputBorder,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 13 }}>
              {label}
            </Text>
            <KISIcon
              name="menu"
              size={14}
              color={palette.subtext}
              style={{ marginLeft: 4 }}
            />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text
          style={[
            styles.errorText,
            { color: palette.error ?? '#e53935' },
          ]}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: canSave
              ? palette.primary
              : palette.disabled ?? palette.surface,
            opacity:
              pressed && canSave
                ? KIS_TOKENS.opacity.pressed
                : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.saveButtonText,
            {
              color: canSave ? palette.onPrimary ?? '#fff' : palette.subtext,
            },
          ]}
        >
          {submitting ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
    </View>
  );
};
