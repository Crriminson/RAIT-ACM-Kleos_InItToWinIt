import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Database, RefreshCw, Trash2, Search, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { Severity } from '../data/types';
import GradientHeader from '../components/GradientHeader';

function normNum(s: string): string {
  return s.replace(/[\s\-/]/g, '').toUpperCase();
}
function formatRupee(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export default function Portal2BScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation();

  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<{ text: string; warn: boolean } | null>(null);

  // Map each filed invoice number -> diagnosis severity (to badge problem rows).
  const severityByNum = useMemo(() => {
    const m = new Map<string, Severity>();
    for (const r of session.results) m.set(normNum(r.invoiceNumber), r.severity);
    return m;
  }, [session.results]);

  const entries = session.gstr2bEntries;
  const filtered = entries.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      e.supplierName.toLowerCase().includes(q) ||
      e.invoiceNumber.toLowerCase().includes(q) ||
      e.gstin.toLowerCase().includes(q)
    );
  });

  const handleSync = () => {
    setSyncing(true);
    setBanner(null);
    setTimeout(() => {
      const { synced, syncedAmount, remaining } = session.syncFromPortal();
      setSyncing(false);
      const amt = '₹' + Math.round(syncedAmount).toLocaleString('en-IN');
      let msg: string;
      if (synced > 0 && remaining > 0) {
        msg = t.portal.syncedSome
          .replace('{{n}}', String(synced))
          .replace('₹{{amt}}', amt)
          .replace('{{rem}}', String(remaining));
      } else if (synced > 0) {
        msg = t.portal.syncedAllClear.replace('{{n}}', String(synced)).replace('₹{{amt}}', amt);
      } else if (remaining > 0) {
        msg = t.portal.nothingMissing.replace('{{rem}}', String(remaining));
      } else {
        msg = t.portal.allSynced;
      }
      // Banner reads as a warning if issues remain, success otherwise.
      setBanner({ text: msg, warn: remaining > 0 });
      setTimeout(() => setBanner(null), 7000);
    }, 1400);
  };

  const handleDelete = (invoiceNumber: string, gstin: string) => {
    session.applyGstr2b(
      entries.filter((e) => !(e.invoiceNumber === invoiceNumber && e.gstin === gstin)),
    );
  };

  return (
    <View style={styles.root}>
      <GradientHeader
        title={t.portal.title}
        subtitle={`${entries.length} ${t.portal.entries}`}
        onBack={() => navigation.goBack()}
      />

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Database size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>{t.portal.empty}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Sync button */}
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.syncButtonBusy]}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.85}
          >
            {syncing ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <RefreshCw size={18} color={colors.surface} />
            )}
            <Text style={styles.syncText}>{syncing ? t.portal.syncing : t.portal.sync}</Text>
          </TouchableOpacity>

          {banner && (
            <View style={[styles.banner, banner.warn && styles.bannerWarn]}>
              {banner.warn ? (
                <AlertTriangle size={16} color={colors.severity.pending} />
              ) : (
                <CheckCircle2 size={16} color={colors.severity.resolved} />
              )}
              <Text style={[styles.bannerText, banner.warn && styles.bannerTextWarn]}>{banner.text}</Text>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchBox}>
            <Search size={18} color={colors.inkMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t.portal.searchPlaceholder}
              placeholderTextColor={colors.inkMuted}
            />
          </View>

          {/* Rows */}
          {filtered.map((e, idx) => {
            const sev = severityByNum.get(normNum(e.invoiceNumber));
            const hasIssue = sev === 'blocked' || sev === 'pending';
            const tax = e.cgst + e.sgst + e.igst;
            return (
              <View key={`${e.gstin}-${e.invoiceNumber}-${idx}`} style={styles.row}>
                <View style={[styles.statusStrip, { backgroundColor: hasIssue ? colors.severity.pending : colors.severity.resolved }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supplier} numberOfLines={1}>{e.supplierName}</Text>
                  <Text style={styles.meta}>{e.invoiceNumber} · {e.gstin}</Text>
                  <Text style={styles.meta}>
                    {formatRupee(e.taxableValue)} + {formatRupee(tax)} tax · HSN {e.items[0]?.hsnCode ?? '—'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: hasIssue ? colors.severity.pendingBg : colors.severity.resolvedBg }]}>
                    {hasIssue ? (
                      <AlertTriangle size={11} color={colors.severity.pending} />
                    ) : (
                      <CheckCircle2 size={11} color={colors.severity.resolved} />
                    )}
                    <Text style={[styles.badgeText, { color: hasIssue ? colors.severity.pending : colors.severity.resolved }]}>
                      {hasIssue ? t.portal.blocked : t.portal.eligible}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(e.invoiceNumber, e.gstin)} hitSlop={8} style={styles.deleteBtn}>
                  <Trash2 size={16} color={colors.inkMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.recognitionBg, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },

  content: { padding: spacing.screenH, paddingBottom: spacing.xl },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.severity.resolved,
    borderRadius: radii.button,
    height: 52,
    ...elevation.card,
  },
  syncButtonBusy: { opacity: 0.85 },
  syncText: { ...typography.label, color: colors.surface, fontSize: 15, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.severity.resolvedBg,
    borderRadius: radii.button,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  bannerWarn: { backgroundColor: colors.severity.pendingBg },
  bannerText: { ...typography.body, color: colors.severity.resolved, flex: 1, fontWeight: '600', fontSize: 14 },
  bannerTextWarn: { color: colors.severity.pending },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink, paddingVertical: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.soft,
  },
  statusStrip: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  supplier: { ...typography.bodyBold, color: colors.ink },
  meta: { ...typography.caption, color: colors.inkMuted, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.badge,
    marginTop: spacing.xs,
  },
  badgeText: { ...typography.caption, fontWeight: '700', fontSize: 11 },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
