import React from 'react';
import { Text, View, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';

type RichTextMark = {
  type: string;
  attrs?: Record<string, any>;
};

type RichTextNode = {
  type: string;
  attrs?: Record<string, any>;
  text?: string;
  marks?: RichTextMark[];
  content?: RichTextNode[];
};

type RichTextDoc = {
  type: 'doc';
  content?: RichTextNode[];
};

type Props = {
  doc?: RichTextDoc;
  value?: RichTextDoc | string | null;
  fallback?: string;
  style?: StyleProp<ViewStyle | TextStyle>;
};

const HEADING_SIZES: Record<number, number> = {
  1: 24,
  2: 22,
  3: 20,
  4: 18,
  5: 16,
  6: 14,
};

const computeMarkStyle = (marks: RichTextMark[] = []): TextStyle => {
  const style: TextStyle = {};
  let underline = false;
  let strikethrough = false;
  marks.forEach((mark) => {
    switch (mark.type) {
      case 'bold':
        style.fontWeight = '700';
        break;
      case 'italic':
        style.fontStyle = 'italic';
        break;
      case 'underline':
        underline = true;
        break;
      case 'strikethrough':
        strikethrough = true;
        break;
      case 'inline_code':
        style.fontFamily = 'Courier';
        style.backgroundColor = '#F4F4F5';
        style.paddingHorizontal = 4;
        style.borderRadius = 4;
        break;
      case 'text_color':
        if (mark.attrs?.color) {
          style.color = mark.attrs.color;
        }
        break;
      case 'highlight':
      case 'background_color':
        if (mark.attrs?.color) {
          style.backgroundColor = mark.attrs.color;
        }
        break;
      case 'font_size':
        if (mark.attrs?.size) {
          style.fontSize = Number(mark.attrs.size);
        }
        break;
      case 'font_family':
        if (mark.attrs?.family) {
          style.fontFamily = mark.attrs.family;
        }
        break;
      case 'letter_spacing':
        if (mark.attrs?.value) {
          style.letterSpacing = Number(mark.attrs.value);
        }
        break;
      case 'line_height':
        if (mark.attrs?.value) {
          style.lineHeight = Number(mark.attrs.value);
        }
        break;
      case 'small_caps':
        style.fontVariant = ['small-caps'];
        break;
      case 'badge':
        style.backgroundColor = '#E0E7FF';
        style.paddingHorizontal = 8;
        style.borderRadius = 12;
        break;
      default:
        break;
    }
  });
  if (underline && strikethrough) {
    style.textDecorationLine = 'underline line-through';
  } else if (underline) {
    style.textDecorationLine = 'underline';
  } else if (strikethrough) {
    style.textDecorationLine = 'line-through';
  }
  return style;
};

const renderInline = (nodes: RichTextNode[] = []) =>
  nodes.map((node, index) => {
    if (node.type === 'text') {
      return (
        <Text key={`inline-${index}`} style={computeMarkStyle(node.marks)}>
          {node.text}
        </Text>
      );
    }
    if (node.content) {
      return <React.Fragment key={`inline-fragment-${index}`}>{renderInline(node.content)}</React.Fragment>;
    }
    return null;
  });

const renderListItem = (
  item: RichTextNode,
  index: number,
  bullet: string,
  align?: TextStyle['textAlign'],
) => (
  <View key={`list-item-${index}`} style={styles.listItem}>
    <Text style={[styles.listBullet, align ? { textAlign: align } : {}]}>{bullet}</Text>
    <View style={{ flex: 1 }}>{renderInline(item.content ?? [])}</View>
  </View>
);

const renderBlock = (node: RichTextNode, index: number, theme: ReturnType<typeof useKISTheme>) => {
  const textAlign =
    (node.attrs?.textAlign as TextStyle['textAlign']) ?? 'left';
  const blockStyle: TextStyle = { textAlign };
  if (node.attrs?.lineHeight) {
    blockStyle.lineHeight = Number(node.attrs.lineHeight);
  }
  if (node.attrs?.fontSize) {
    blockStyle.fontSize = Number(node.attrs.fontSize);
  }
  if (node.attrs?.color) {
    blockStyle.color = node.attrs.color;
  }
  if (node.attrs?.backgroundColor) {
    blockStyle.backgroundColor = node.attrs.backgroundColor;
    blockStyle.paddingVertical = 4;
    blockStyle.paddingHorizontal = 6;
    blockStyle.borderRadius = 6;
  }

  switch (node.type) {
    case 'paragraph':
      return (
        <Text key={`block-${index}`} style={[styles.paragraph, blockStyle, { color: theme.palette.text }]}>
          {renderInline(node.content ?? [])}
        </Text>
      );
    case 'heading':
      return (
        <Text
          key={`block-${index}`}
          style={[
            styles.heading,
            {
              fontSize: HEADING_SIZES[node.attrs?.level ?? 1] ?? 18,
              color: theme.palette.text,
            },
            blockStyle,
          ]}
        >
          {renderInline(node.content ?? [])}
        </Text>
      );
    case 'blockquote':
      return (
        <View key={`block-${index}`} style={styles.blockquote}>
          <Text style={[styles.blockquoteText, blockStyle]}>{renderInline(node.content ?? [])}</Text>
        </View>
      );
    case 'code_block':
      return (
        <View key={`block-${index}`} style={styles.codeBlock}>
          <Text style={styles.codeText}>{renderInline(node.content ?? [])}</Text>
        </View>
      );
    case 'horizontal_rule':
      return <View key={`block-${index}`} style={[styles.horizontalRule, { borderColor: theme.palette.border }]} />;
    case 'ordered_list':
      return (
        <View key={`block-${index}`} style={styles.list}>
          {(node.content ?? []).map((item, idx) =>
            renderListItem(item, idx, `${idx + 1}.`, textAlign),
          )}
        </View>
      );
    case 'bullet_list':
      return (
        <View key={`block-${index}`} style={styles.list}>
          {(node.content ?? []).map((item, idx) => renderListItem(item, idx, '•', textAlign))}
        </View>
      );
    case 'task_list':
      return (
        <View key={`block-${index}`} style={styles.list}>
          {(node.content ?? []).map((item, idx) => (
            <View key={`task-${idx}`} style={styles.taskItem}>
              <Text style={styles.taskBullet}>◻</Text>
              <View style={{ flex: 1 }}>{renderInline(item.content ?? [])}</View>
            </View>
          ))}
        </View>
      );
    default:
      return (
        <Text key={`block-${index}`} style={[styles.paragraph, blockStyle, { color: theme.palette.text }]}>
          {renderInline(node.content ?? [])}
        </Text>
      );
  }
};

const renderDoc = (doc: RichTextDoc | undefined, theme: ReturnType<typeof useKISTheme>) => {
  if (!doc || doc.type !== 'doc') {
    return null;
  }
  return doc.content?.map((node, index) => renderBlock(node, index, theme)) ?? null;
};

export default function RichTextRenderer({ doc, value, fallback, style }: Props) {
  const theme = useKISTheme();
  const normalizedDoc =
    doc ??
    (value && typeof value === 'object' && (value as RichTextDoc).type === 'doc'
      ? (value as RichTextDoc)
      : undefined);
  const fallbackText = fallback ?? (typeof value === 'string' ? value : undefined);
  if (!normalizedDoc || !normalizedDoc.content?.length) {
    if (!fallbackText) {
      return null;
    }
    return (
      <Text style={[styles.paragraph, { color: theme.palette.text }, style]}>{fallbackText}</Text>
    );
  }
  return <View style={style as StyleProp<ViewStyle>}>{renderDoc(normalizedDoc, theme)}</View>;
}

const styles = StyleSheet.create({
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  heading: {
    marginBottom: 6,
    fontWeight: '700',
  },
  blockquote: {
    borderLeftWidth: 3,
    borderColor: '#94a3b8',
    paddingLeft: 12,
    marginVertical: 8,
  },
  blockquoteText: {
    fontStyle: 'italic',
  },
  codeBlock: {
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  codeText: {
    color: '#e2e8f0',
    fontFamily: 'Courier',
  },
  horizontalRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  list: {
    marginVertical: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  listBullet: {
    width: 20,
    fontWeight: '600',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  taskBullet: {
    fontSize: 16,
  },
});
