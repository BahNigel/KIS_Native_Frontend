// src/screens/partners/PartnerCreateSlide.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';

import { useKISTheme } from '../../theme/useTheme';
import KISButton from '../../constants/KISButton';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

type Props = {
  onClose: () => void;
};

export default function PartnerCreateSlide({ onClose }: Props) {
  const { palette } = useKISTheme();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      Alert.alert('Missing fields', 'Name and slug are required.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      avatar_url: avatarUrl.trim(),
      create_main_conversation: true,
    };

    const res = await postRequest(ROUTES.partners.create, payload, {
      errorMessage: 'Unable to create partner.',
    });

    setIsSubmitting(false);

    if (!res.success) {
      Alert.alert('Error', res.message || 'Could not create partner.');
      return;
    }

    Alert.alert('Success', 'Partner created successfully!', [
      { text: 'OK', onPress: onClose },
    ]);
  };

  const autoSlugify = (value: string) => {
    setName(value);
    if (!slug) {
      const s = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(s);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <KISButton title="Back" variant="outline" onPress={onClose} />
          <Text style={[styles.title, { color: palette.text }]}>Create Partner</Text>
          <View style={{ width: 75 }} />
        </View>

        {/* Form Fields */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Name *</Text>
          <TextInput
            value={name}
            onChangeText={autoSlugify}
            placeholder="Partner name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.inputBorder, color: palette.text }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Slug *</Text>
          <TextInput
            value={slug}
            onChangeText={setSlug}
            placeholder="partner-slug"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.inputBorder, color: palette.text }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Short description…"
            multiline
            placeholderTextColor={palette.subtext}
            style={[
              styles.input,
              styles.textarea,
              { backgroundColor: palette.card, borderColor: palette.inputBorder, color: palette.text }
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: palette.subtext }]}>Avatar URL</Text>
          <TextInput
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            autoCapitalize="none"
            placeholder="https://example.com/logo.png"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { backgroundColor: palette.card, borderColor: palette.inputBorder, color: palette.text }]}
          />
        </View>

        <View style={{ marginTop: 24 }}>
          <KISButton
            title={isSubmitting ? 'Creating…' : 'Create Partner'}
            onPress={handleSubmit}
            disabled={isSubmitting}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
