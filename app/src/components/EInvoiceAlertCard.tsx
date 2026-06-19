import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Text } from './AppText';
import { AlertTriangle, X } from 'lucide-react-native';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { EInvoiceAlertData } from '../api/ai';

interface EInvoiceAlertCardProps {
  alert: EInvoiceAlertData;
  lang: 'en' | 'hi';
  onDismiss: () => void;
}

export default function EInvoiceAlertCard({ alert, lang, onDismiss }: EInvoiceAlertCardProps) {
  // Severity overrides
  let accentColor: string = colors.primary;
  let bgColor: string = colors.surface;

  if (alert.severity === 'applies_now') {
    accentColor = colors.severity.blocked;
    bgColor = colors.severity.blockedBg;
  } else if (alert.severity === 'approaching') {
    accentColor = colors.severity.pending;
    bgColor = colors.severity.pendingBg;
  } else if (alert.severity === 'informational') {
    accentColor = colors.primary;
    bgColor = colors.surface;
  }

  const headline = lang === 'hi' ? alert.headline_hi : alert.headline_en;
  const body = lang === 'hi' ? alert.body_hi : alert.body_en;
  const actionLabel = lang === 'hi' ? alert.action_label_hi : alert.action_label_en;
  const caNudge = lang === 'hi' ? alert.ca_nudge_hi : alert.ca_nudge_en;
  const disclaimer = lang === 'hi' ? alert.disclaimer_hi : alert.disclaimer_en;

  const handlePressAction = async () => {
    try {
      await Linking.openURL(alert.action_url || 'https://einvoice1.gst.gov.in');
    } catch (e) {
      console.warn('Cannot open URL', e);
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: accentColor, backgroundColor: bgColor }]}>
      <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <X size={18} color={colors.inkMuted} />
      </TouchableOpacity>

      <View style={styles.header}>
        <AlertTriangle size={20} color={accentColor} style={styles.icon} />
        <Text style={[styles.headline, { color: colors.ink }]} numberOfLines={2}>{headline}</Text>
      </View>

      <Text style={styles.body}>{body}</Text>

      <TouchableOpacity style={[styles.actionBtn, { borderColor: accentColor }]} onPress={handlePressAction}>
        <Text style={[styles.actionLabel, { color: accentColor }]}>{actionLabel}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.caNudge}>{caNudge}</Text>
        <Text style={styles.disclaimer}>{disclaimer}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenH,
    marginBottom: spacing.md,
    borderRadius: radii.card,
    borderLeftWidth: 4,
    padding: spacing.md,
    ...elevation.soft,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingRight: 24, // Space for close button
  },
  icon: {
    marginRight: spacing.sm,
  },
  headline: {
    ...typography.heading2,
    flex: 1,
  },
  body: {
    ...typography.body,
    color: colors.inkSecondary,
    marginBottom: spacing.md,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  actionLabel: {
    ...typography.label,
  },
  footer: {
    marginTop: spacing.xs,
  },
  caNudge: {
    ...typography.caption,
    color: colors.inkMuted,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
