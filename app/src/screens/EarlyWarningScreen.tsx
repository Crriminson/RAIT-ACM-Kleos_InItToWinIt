import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AlertTriangle, Clock, RefreshCcw } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { getEarlyWarningList, EarlyWarningSupplier } from '../api/ai';
import GradientHeader from '../components/GradientHeader';

export default function EarlyWarningScreen() {
  const { lang } = useI18n();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<EarlyWarningSupplier[]>([]);
  const [error, setError] = useState(false);

  const fetchWarnings = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getEarlyWarningList();
      setSuppliers(data.suppliers || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarnings();
  }, []);

  const totalRisk = suppliers.reduce((acc, curr) => acc + curr.estimated_itc_at_risk, 0);

  return (
    <View style={styles.root}>
      <GradientHeader 
        title={lang === 'hi' ? 'GSTR-2A अर्ली वार्निंग' : 'GSTR-2A Early Warning'} 
        onBack={() => navigation.goBack()} 
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {lang === 'hi' ? 'सप्लायर फाइलिंग चेक कर रहे हैं...' : 'Checking supplier filings...'}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <AlertTriangle size={48} color={colors.severity.blocked} />
          <Text style={styles.errorText}>
            {lang === 'hi' ? 'डेटा लोड नहीं हो पाया।' : 'Could not load early warnings.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchWarnings}>
            <RefreshCcw size={16} color="#fff" />
            <Text style={styles.retryBtnText}>{lang === 'hi' ? 'फिर से कोशिश करें' : 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Clock size={24} color={colors.severity.blocked} />
              <Text style={styles.summaryTitle}>
                {lang === 'hi' ? '14 तारीख की डेडलाइन से पहले' : 'Before the 14th Deadline'}
              </Text>
            </View>
            <Text style={styles.summaryBody}>
              {lang === 'hi' 
                ? `${suppliers.length} सप्लायर्स ने अभी तक फाइल नहीं किया है। अगर वे फाइल नहीं करते हैं, तो आपका ₹${totalRisk.toFixed(2)} का ITC ब्लॉक हो सकता है।` 
                : `${suppliers.length} suppliers haven't filed yet. If left unresolved, ₹${totalRisk.toFixed(2)} in ITC could be blocked.`}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            {lang === 'hi' ? 'पेंडिंग सप्लायर्स' : 'Pending Suppliers'}
          </Text>

          {suppliers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {lang === 'hi' ? 'सभी सप्लायर्स ने फाइल कर दिया है।' : 'All suppliers appear to have filed.'}
              </Text>
            </View>
          ) : (
            suppliers.map((s, idx) => (
              <View key={idx} style={styles.supplierCard}>
                <View style={styles.supplierInfo}>
                  <Text style={styles.supplierName} numberOfLines={1}>{s.supplier_name}</Text>
                  <Text style={styles.supplierGstin}>{s.supplier_gstin}</Text>
                  <Text style={styles.invoiceCount}>
                    {lang === 'hi' ? `${s.unfiled_count} इनवॉइस पेंडिंग` : `${s.unfiled_count} invoices pending`}
                  </Text>
                </View>
                <View style={styles.riskBadge}>
                  <Text style={styles.riskAmount}>₹{s.estimated_itc_at_risk.toFixed(2)}</Text>
                  <Text style={styles.riskLabel}>{lang === 'hi' ? 'ITC रिस्क' : 'ITC Risk'}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { ...typography.body, color: colors.inkMuted, marginTop: spacing.md },
  errorText: { ...typography.body, color: colors.ink, marginTop: spacing.md, marginBottom: spacing.md },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.button,
  },
  retryBtnText: { ...typography.bodyBold, color: '#fff' },
  
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  summaryCard: {
    backgroundColor: colors.severity.blockedBg,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.2)',
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  summaryTitle: { ...typography.heading2, color: colors.severity.blocked },
  summaryBody: { ...typography.body, color: colors.ink, lineHeight: 22 },

  sectionTitle: { ...typography.heading2, color: colors.ink, marginBottom: spacing.sm, marginLeft: 4 },
  emptyState: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.inkMuted },

  supplierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.soft,
  },
  supplierInfo: { flex: 1, paddingRight: spacing.sm },
  supplierName: { ...typography.bodyBold, color: colors.ink, marginBottom: 2 },
  supplierGstin: { ...typography.caption, color: colors.inkMuted, marginBottom: 4 },
  invoiceCount: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  
  riskBadge: {
    alignItems: 'flex-end',
    backgroundColor: colors.severity.blockedBg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  riskAmount: { ...typography.heading2, color: colors.severity.blocked },
  riskLabel: { ...typography.caption, color: colors.severity.blocked, opacity: 0.8 },
});
