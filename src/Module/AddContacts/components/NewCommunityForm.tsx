// src/screens/chat/components/NewCommunityForm.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { KIS_TOKENS } from '../../../theme/constants';
import { KISIcon } from '@/constants/kisIcons';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';

type NewCommunityFormProps = {
  palette: {
    bg: string;
    card: string;
    text: string;
    subtext: string;
    primary: string;
    inputBorder: string;
    error?: string;
  };
  onSuccess: (community: any) => void;
  selectedMemberIds: string[];
  onSelectMembers: () => void;
  showMemberPicker?: boolean;
  partnerId?: string | null;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const NewCommunityForm: React.FC<NewCommunityFormProps> = ({
  palette,
  onSuccess,
  selectedMemberIds,
  onSelectMembers,
  showMemberPicker = true,
  partnerId,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const memberCountLabel = `${selectedMemberIds.length} selected`;

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter a community name.');
      return;
    }

    const finalSlug = slug.trim() ? slugify(slug) : slugify(trimmedName);

    try {
      setSubmitting(true);

      const payload = {
        name: trimmedName,
        slug: finalSlug,
        description: description.trim() || undefined,
        partner: partnerId ?? null,
      };

      const createdCommunity = await postRequest(
        ROUTES.community.create,
        payload,
        { errorMessage: 'Unable to create community.' },
      );
      if (!createdCommunity?.success || !createdCommunity.data) {
        throw new Error(createdCommunity?.message || 'Unable to create community.');
      }

      const communityData = createdCommunity.data;
      const communityId = communityData?.id;
      if (communityId && selectedMemberIds.length > 0) {
        const userIds = selectedMemberIds;
        await postRequest(ROUTES.community.addMembers(communityId), { userIds });
      }

      onSuccess(communityData);
    } catch (e: any) {
      console.warn('Error creating community:', e);
      Alert.alert(
        'Error',
        e?.message || 'Could not create the community. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          color: palette.text,
          fontSize: 16,
          fontWeight: '600',
          marginBottom: 12,
        }}
      >
        Create a new community
      </Text>

      {/* Community name */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          Community name
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. KIS Global Prayer"
            placeholderTextColor={palette.subtext}
            style={{ color: palette.text, fontSize: 14 }}
          />
        </View>
      </View>

      {/* Slug (optional) */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          Community slug (optional)
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={slug}
            onChangeText={setSlug}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. kis-global-prayer"
            placeholderTextColor={palette.subtext}
            style={{ color: palette.text, fontSize: 14 }}
          />
        </View>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 11,
            marginTop: 4,
          }}
        >
          If left empty, we’ll generate one from the community name.
        </Text>
      </View>

      {/* Description (optional) */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            color: palette.subtext,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          Description (optional)
        </Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.inputBorder,
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this community about?"
            placeholderTextColor={palette.subtext}
            style={{
              color: palette.text,
              fontSize: 14,
              minHeight: 60,
              textAlignVertical: 'top',
            }}
            multiline
          />
        </View>
      </View>

      {showMemberPicker ? (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: palette.subtext, fontSize: 13 }}>Members</Text>
            <Text style={{ color: palette.subtext, fontSize: 12 }}>{memberCountLabel}</Text>
          </View>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: palette.inputBorder,
              backgroundColor: palette.card,
              padding: 10,
            }}
          >
            <Pressable
              onPress={onSelectMembers}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: palette.inputBorder,
                backgroundColor: pressed ? palette.surface : 'transparent',
              })}
            >
              <Text style={{ color: palette.text, fontSize: 13 }}>
                Add or edit members
              </Text>
              <KISIcon name="chevron-right" size={16} color={palette.subtext} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Submit button */}
      <Pressable
        onPress={submitting ? undefined : handleSubmit}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 16,
          backgroundColor: palette.primary,
          opacity:
            submitting || !name.trim()
              ? 0.6
              : pressed
              ? KIS_TOKENS.opacity.pressed
              : 1,
        })}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <KISIcon name="megaphone" size={16} color="#fff" />
            <Text
              style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: '600',
                marginLeft: 6,
              }}
            >
              Create community
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
};

export default NewCommunityForm;
