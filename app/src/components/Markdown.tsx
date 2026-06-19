import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { colors, typography, spacing } from '../theme/tokens';

/**
 * Minimal Markdown renderer for the AI advisory text.
 * Handles: ### / #### headings, * / - / numbered bullets, **bold** inline, blank lines.
 */

function renderInline(text: string, keyPrefix: string) {
  // Split on **bold** segments.
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '');
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={`${keyPrefix}-b-${i}`} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={`${keyPrefix}-t-${i}`}>{part}</Text>;
  });
}

export default function Markdown({ children }: { children: string }) {
  const lines = children.replace(/\r/g, '').split('\n');

  return (
    <View>
      {lines.map((raw, idx) => {
        const line = raw.trimEnd();
        const key = `md-${idx}`;

        if (line.trim() === '') return <View key={key} style={styles.gap} />;

        if (line.startsWith('#### ')) {
          return <Text key={key} style={styles.h2}>{line.slice(5)}</Text>;
        }
        if (line.startsWith('### ')) {
          return <Text key={key} style={styles.h1}>{line.slice(4)}</Text>;
        }
        if (line.startsWith('## ')) {
          return <Text key={key} style={styles.h1}>{line.slice(3)}</Text>;
        }

        // Bullets: "* ", "*   ", "- "
        const bulletMatch = line.match(/^\s*[*-]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <View key={key} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{renderInline(bulletMatch[1], key)}</Text>
            </View>
          );
        }

        // Numbered: "1. ..."
        const numMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <View key={key} style={styles.bulletRow}>
              <Text style={styles.numDot}>{numMatch[1]}.</Text>
              <Text style={styles.bulletText}>{renderInline(numMatch[2], key)}</Text>
            </View>
          );
        }

        return <Text key={key} style={styles.paragraph}>{renderInline(line, key)}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { height: spacing.sm },
  h1: { ...typography.heading2, color: colors.ink, marginTop: spacing.sm, marginBottom: spacing.xs },
  h2: { ...typography.bodyBold, color: colors.primary, marginTop: spacing.sm, marginBottom: spacing.xs },
  paragraph: { ...typography.body, color: colors.inkSecondary, marginBottom: 2 },
  bold: { ...typography.bodyBold, color: colors.ink },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, paddingRight: spacing.sm },
  bulletDot: { ...typography.body, color: colors.primary, lineHeight: 22 },
  numDot: { ...typography.bodyBold, color: colors.primary, lineHeight: 22, minWidth: 18 },
  bulletText: { ...typography.body, color: colors.inkSecondary, flex: 1 },
});
