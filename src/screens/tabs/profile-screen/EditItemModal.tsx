import React from 'react';
import { Pressable, Text, View } from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import type { ItemType } from '../profile/profile.types';

type EditItemModalProps = {
  palette: KISPalette;
  draftItem: any;
  setDraftItem: React.Dispatch<React.SetStateAction<any>>;
  pickShowcaseFile?: (itemType: ItemType) => Promise<any>;
  saving: boolean;
  saveItem: () => void;
};

export function EditItemModal(props: EditItemModalProps) {
  const { palette, draftItem, setDraftItem, pickShowcaseFile, saving, saveItem } = props;

  return (
    <View style={{ gap: 12 }}>
      <KISTextInput
        label="Title / Name"
        value={draftItem?.data?.title || draftItem?.data?.name || ''}
        onChangeText={(t) =>
          setDraftItem((s: any) => ({
            ...s,
            data: {
              ...s.data,
              title: s.data?.title != null ? t : s.data?.title,
              name: s.data?.name != null ? t : s.data?.name,
            },
          }))
        }
      />

      <KISTextInput
        label="Description / Summary"
        value={draftItem?.data?.description || draftItem?.data?.summary || ''}
        onChangeText={(t) =>
          setDraftItem((s: any) => ({
            ...s,
            data: { ...s.data, description: t, summary: t },
          }))
        }
        multiline
        style={{ minHeight: 100 }}
      />

      {typeof pickShowcaseFile === 'function' && (
        <Pressable
          onPress={async () => {
            const file = await pickShowcaseFile(draftItem?.type);
            if (file) setDraftItem((s: any) => ({ ...s, data: { ...s.data, file } }));
          }}
          style={[styles.mediaPickCard, { backgroundColor: palette.surface }]}
        >
          <Text style={[styles.mediaPickLabel, { color: palette.text }]}>Attach media (optional)</Text>
          {draftItem?.data?.file?.name ? (
            <Text style={[styles.subtext, { color: palette.subtext }]} numberOfLines={1}>
              {draftItem.data.file.name}
            </Text>
          ) : null}
        </Pressable>
      )}

      <KISButton title={saving ? 'Saving...' : 'Save'} onPress={saveItem} disabled={saving} />
    </View>
  );
}
