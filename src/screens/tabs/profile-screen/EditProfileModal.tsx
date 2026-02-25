import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';

type EditProfileModalProps = {
  palette: KISPalette;
  draftProfile: any;
  setDraftProfile: React.Dispatch<React.SetStateAction<any>>;
  pickImage: (type: 'avatar' | 'cover') => Promise<void>;
  saving: boolean;
  saveProfile: () => void;
};

export function EditProfileModal(props: EditProfileModalProps) {
  const { palette, draftProfile, setDraftProfile, pickImage, saving, saveProfile } = props;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.editMediaRow}>
        <Pressable
          onPress={() => pickImage('avatar')}
          style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
        >
          {draftProfile?.avatar_preview ? (
            <Image source={{ uri: draftProfile.avatar_preview }} style={styles.mediaPickImage} />
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
          <Text style={[styles.mediaPickLabel, { color: palette.text }]}>Change avatar</Text>
        </Pressable>

        <Pressable
          onPress={() => pickImage('cover')}
          style={[styles.mediaPickCard, { backgroundColor: palette.surface, flex: 1 }]}
        >
          {draftProfile?.cover_preview ? (
            <Image source={{ uri: draftProfile.cover_preview }} style={styles.mediaPickImageWide} />
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
          <Text style={[styles.mediaPickLabel, { color: palette.text }]}>Change cover</Text>
        </Pressable>
      </View>

      <KISTextInput
        label="Display name"
        value={draftProfile?.display_name}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, display_name: t }))}
      />
      <KISTextInput
        label="Headline"
        value={draftProfile?.headline}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, headline: t }))}
      />
      <KISTextInput
        label="Industry"
        value={draftProfile?.industry}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, industry: t }))}
      />
      <KISTextInput
        label="Bio"
        value={draftProfile?.bio}
        onChangeText={(t) => setDraftProfile((s: any) => ({ ...s, bio: t }))}
        multiline
        style={{ minHeight: 110, color: palette.text }}
      />

      <KISButton style={{marginTop: 80}} title={saving ? 'Saving...' : 'Save'} onPress={saveProfile} disabled={saving} />
    </View>
  );
}
