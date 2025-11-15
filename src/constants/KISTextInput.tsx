// src/components/KISTextInput.tsx
import React, { useMemo, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import { useKISTheme } from '../theme/useTheme';

type Adornment = React.ReactNode | ((color: string) => React.ReactNode);

type Props = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
  /** If you want to mark error state without showing a message */
  error?: boolean;
  left?: Adornment;
  right?: Adornment;
  loading?: boolean;
  /** Shows a small clear button when there's text and not secure */
  allowClear?: boolean;
  /** Called when user taps the clear button; if not provided we call onChangeText('') */
  onClear?: (e: GestureResponderEvent) => void;
  containerStyle?: any;
};

export default function KISTextInput({
  label,
  helperText,
  errorText,
  error,
  left,
  right,
  secureTextEntry,
  loading,
  style,
  containerStyle,
  value,
  onChangeText,
  ...rest
}: Props) {
  const { palette, tokens } = useKISTheme();
  const [secure, setSecure] = useState(!!secureTextEntry);

  const hasError = !!errorText || !!error;

  const borderColor = useMemo(() => {
    if (hasError) return palette.borderDanger;
    return palette.inputBorder;
  }, [hasError, palette]);

  const showClear =
    !!value &&
    typeof value === 'string' &&
    value.length > 0 &&
    !secure &&
    !loading &&
    !right &&
    (rest.editable ?? true) !== false;

  const handleClear = (e: GestureResponderEvent) => {
    if (typeof onChangeText === 'function' && !rest.readOnly) {
      onChangeText('');
    }
    if (typeof (rest as any)?.onClear === 'function') {
      (rest as any).onClear(e);
    }
  };

  const RightAdornment = useMemo(() => {
    if (loading) {
      return <ActivityIndicator size="small" style={styles.adornment} />;
    }

    if (secureTextEntry) {
      return (
        <TouchableOpacity
          onPress={() => setSecure((s) => !s)}
          style={styles.adornmentHitbox}
          accessibilityRole="button"
          accessibilityLabel={secure ? 'Show password' : 'Hide password'}
        >
          <Text style={{ color: palette.subtext, fontWeight: '600' }}>
            {secure ? 'Show' : 'Hide'}
          </Text>
        </TouchableOpacity>
      );
    }

    if (showClear && (rest as any).allowClear) {
      return (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.adornmentHitbox}
          accessibilityRole="button"
          accessibilityLabel="Clear text"
        >
          <Text style={{ color: palette.subtext, fontWeight: '600' }}>Clear</Text>
        </TouchableOpacity>
      );
    }

    if (right)
      return (
        <View style={styles.adornment}>
          {typeof right === 'function' ? right(palette.subtext) : right}
        </View>
      );

    return null;
  }, [loading, secure, secureTextEntry, right, palette, showClear]);

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label ? (
        <Text
          style={{ marginBottom: 6, color: palette.subtext, fontSize: tokens.typography.label }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: palette.inputBg,
            borderColor,
            borderRadius: tokens.radius.lg,
            height: tokens.controlHeights.md,
          },
        ]}
      >
        {left ? (
          <View style={[styles.adornment, { marginLeft: 8 }]}>
            {typeof left === 'function' ? left(palette.subtext) : left}
          </View>
        ) : null}

        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          placeholderTextColor={palette.subtext}
          style={[
            styles.input,
            {
              color: palette.text,
              fontSize: tokens.typography.input,
            },
            style,
          ]}
        />

        {RightAdornment}
      </View>

      {!!errorText && (
        <Text style={{ color: palette.danger, marginTop: 6, fontSize: tokens.typography.helper }}>
          {errorText}
        </Text>
      )}

      {!errorText && !!helperText && (
        <Text style={{ color: palette.subtext, marginTop: 6, fontSize: tokens.typography.helper }}>
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
  adornment: {
    marginHorizontal: 6,
    justifyContent: 'center',
  },
  adornmentHitbox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
