// src/screens/chat/components/EventModal.tsx

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { KISPalette, KIS_TOKENS, kisRadius } from '@/theme/constants';

export type EventDraft = {
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
};

type EventModalProps = {
  visible: boolean;
  palette: KISPalette;
  onClose: () => void;
  onCreateEvent?: (event: EventDraft) => void;
};

export const EventModal: React.FC<EventModalProps> = ({
  visible,
  palette,
  onClose,
  onCreateEvent,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(''); // you can later replace with DatePicker
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!title.trim()) {
      return;
    }

    const event: EventDraft = {
      title: title.trim(),
      date: date.trim(),
      time: time.trim(),
      location: location.trim(),
      description: description.trim(),
    };

    if (onCreateEvent) {
      onCreateEvent(event);
    }

    onClose();

    setTitle('');
    setDate('');
    setTime('');
    setLocation('');
    setDescription('');
  };

  const inputStyle = {
    borderRadius: kisRadius.lg,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBg,
    paddingHorizontal: KIS_TOKENS.spacing.md,
    paddingVertical: KIS_TOKENS.spacing.sm,
    color: palette.text,
    marginBottom: KIS_TOKENS.spacing.md,
  } as const;

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: palette.backdrop,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: palette.surfaceElevated,
            borderTopLeftRadius: kisRadius.xl,
            borderTopRightRadius: kisRadius.xl,
            padding: KIS_TOKENS.spacing.lg,
            maxHeight: '80%',
          }}
        >
          <Text
            style={{
              fontSize: KIS_TOKENS.typography.title,
              fontWeight: KIS_TOKENS.typography.weight.bold,
              color: palette.text,
              marginBottom: KIS_TOKENS.spacing.md,
            }}
          >
            Create an event
          </Text>

          <ScrollView>
            <Text style={{ color: palette.subtext }}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Birthday, meetup..."
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            <Text style={{ color: palette.subtext }}>Date</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            <Text style={{ color: palette.subtext }}>Time</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            <Text style={{ color: palette.subtext }}>Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Online / physical address"
              placeholderTextColor={palette.subtext}
              style={inputStyle}
            />

            <Text style={{ color: palette.subtext }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional details..."
              placeholderTextColor={palette.subtext}
              multiline
              style={[
                inputStyle,
                { height: 80, textAlignVertical: 'top' as const },
              ]}
            />
          </ScrollView>

          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: KIS_TOKENS.spacing.sm,
              marginTop: KIS_TOKENS.spacing.sm,
            }}
          >
            <Pressable onPress={onClose}>
              <Text style={{ color: palette.subtext }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleCreate}>
              <Text style={{ color: palette.primary, fontWeight: '700' }}>
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
