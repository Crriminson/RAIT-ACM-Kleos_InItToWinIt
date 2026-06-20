import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Linking } from 'react-native';
import { Text } from '../components/AppText';
import {
  ChevronRight,
  Bell,
  Shield,
  FileText,
  HelpCircle,
  LogOut,
  CheckCircle2,
  Edit3,
  Clock,
  Lock,
  DownloadCloud,
  Languages
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { useProfile } from '../data/contexts/profile-context';
import { useLock } from '../data/contexts/lock-context';
import { confirmAction } from '../utils/dialog';
import { RootStackParamList } from '../navigation/types';

function formatRupee(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export default function ProfileScreen() {
  const { t, lang, toggle } = useI18n();
  const session = useSession();
  const { profile } = useProfile();
  const { enabled: lockEnabled } = useLock();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isHi = lang === 'hi';
  
  const tx = {
    title: isHi ? 'प्रोफाइल' : 'Profile',
    businessName: profile?.shopName || (isHi ? 'शर्मा किराना स्टोर' : 'Sharma Kirana Store'),
    gstin: profile?.gstin || '07ABCDS1234E1Z5',
    gstinLabel: 'GSTIN',
    filingCycle: isHi ? 'मासिक फाइलर' : 'Monthly filer',
    filingType: 'GSTR-3B',
    editProfile: isHi ? 'संपादित करें' : 'Edit',
    statsTitle: isHi ? 'इस तिमाही' : 'This Quarter',
    invoicesReconciled: isHi ? 'सुलह किए' : 'Reconciled',
    itcAccepted: isHi ? 'स्वीकृत' : 'Accepted',
    onHold: isHi ? 'होल्ड पर' : 'On hold',
    rejected: isHi ? 'अस्वीकृत' : 'Rejected',
    safeItcLabel: isHi ? 'इस तिमाही सुरक्षित ITC' : 'Safe ITC this quarter',
    settingsTitle: isHi ? 'सेटिंग्स और गोपनीयता' : 'Settings & Privacy',
    notifLabel: isHi ? 'सूचनाएं' : 'Notifications',
    notifSub: isHi ? 'फाइलिंग रिमाइंडर और ITC अलर्ट' : 'Filing reminders & ITC alerts',
    pinLabel: isHi ? 'PIN लॉक' : 'PIN Lock',
    pinSub: isHi ? '4-अंकीय PIN से ऐप सुरक्षित करें' : 'Secure app with a 4-digit PIN',
    langLabel: isHi ? 'भाषा' : lang === 'mr' ? 'भाषा' : 'Language',
    langSub: lang === 'hi' ? 'हिंदी → English' : lang === 'mr' ? 'मराठी → हिंदी' : 'English → मराठी',
    privacyLabel: isHi ? 'गोपनीयता और डेटा' : 'Privacy & Data',
    privacySub: isHi ? 'अपना डेटा एक्सपोर्ट या डिलीट करें' : 'Export or delete your data',
    historyTitle: isHi ? 'फाइलिंग इतिहास' : 'Filing History',
    mar24: isHi ? 'मार्च 2024' : 'March 2024',
    mar24Status: isHi ? 'लंबित' : 'Pending',
    feb24: isHi ? 'फरवरी 2024' : 'February 2024',
    feb24Status: isHi ? 'दाखिल' : 'Filed',
    helpTitle: isHi ? 'सहायता' : 'Help & Support',
    faqLabel: isHi ? 'FAQ और गाइड' : 'FAQ & Guides',
    faqSub: isHi ? 'GST मूल बातें, ITC नियम, GSTR-2B गाइड' : 'GST basics, ITC rules, GSTR-2B guide',
    supportLabel: isHi ? 'सहायता से संपर्क करें' : 'Contact Support',
    supportSub: isHi ? 'कोई समस्या रिपोर्ट करें' : 'Report a bug or ask a question',
    exportLabel: isHi ? 'रिपोर्ट एक्सपोर्ट करें' : 'Export Report',
    exportSub: isHi ? 'PDF के रूप में डाउनलोड करें' : 'Download reconciliation as PDF',
    logout: isHi ? 'साइन आउट / डेटा डिलीट करें' : 'Sign out / Clear data',
  };

  const initials = tx.businessName.trim().slice(0, 2).toUpperCase();

  const handleClearData = () => {
    confirmAction(
      t.profile.clearData,
      isHi ? 'सारा local data हट जाएगा। पक्का?' : 'All local data will be removed. Are you sure?',
      () => session.clearAll(),
      {
        confirmLabel: t.profile.clearData,
        cancelLabel: isHi ? 'रद्द करें' : 'Cancel',
        destructive: true,
      },
    );
  };

  const [notifEnabled, setNotifEnabled] = useState(true);

  const results = session.results;
  const acceptedCount = results.filter((r) => r.severity === 'resolved').length;
  const heldCount = results.filter((r) => r.severity === 'pending').length;
  const rejectedCount = results.filter((r) => r.severity === 'blocked').length;
  const totalCount = session.invoices.length;
  const safeItc = session.summary.totalResolved;

  const statCards = [
    { label: tx.itcAccepted, value: acceptedCount, bg: colors.severity.resolvedBg, text: colors.severity.resolved, border: 'rgba(34,197,94,0.3)' },
    { label: tx.onHold, value: heldCount, bg: colors.severity.pendingBg, text: colors.severity.pending, border: 'rgba(245,158,11,0.3)' },
    { label: tx.rejected, value: rejectedCount, bg: colors.severity.blockedBg, text: colors.severity.blocked, border: 'rgba(239,68,68,0.3)' },
    { label: tx.invoicesReconciled, value: totalCount, bg: colors.surfaceRaised, text: colors.ink, border: colors.border },
  ];

  const filingHistory = [
    { month: 'mar24', label: tx.mar24, status: tx.mar24Status, itc: 62400, color: 'hold' },
    { month: 'feb24', label: tx.feb24, status: tx.feb24Status, itc: 54800, color: 'accept' },
  ];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{tx.title}</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('GstinSetup', { mode: 'edit' })}>
              <Edit3 size={14} color={colors.inkMuted} />
              <Text style={styles.editBtnText}>{tx.editProfile}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.businessRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.businessName}>{tx.businessName}</Text>
              <View style={styles.gstinChip}>
                <Text style={styles.gstinLabel}>{tx.gstinLabel}</Text>
                <Text style={styles.gstinValue}>{tx.gstin}</Text>
              </View>
              <View style={styles.cycleRow}>
                <Clock size={12} color={colors.inkMuted} />
                <Text style={styles.cycleText}>{tx.filingCycle} · {tx.filingType}</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Quarter Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx.statsTitle}</Text>
          <View style={styles.safeItcCard}>
            <View>
              <Text style={styles.safeItcLabel}>{tx.safeItcLabel}</Text>
              <Text style={styles.safeItcValue}>{formatRupee(safeItc)}</Text>
            </View>
            <CheckCircle2 size={40} color={colors.severity.resolved} style={{ opacity: 0.25 }} />
          </View>
          <View style={styles.statsGrid}>
            {statCards.map((s, i) => (
              <View key={i} style={[styles.statCard, { backgroundColor: s.bg, borderColor: s.border }]}>
                <Text style={[styles.statValue, { color: s.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: s.text }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Filing History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx.historyTitle}</Text>
          <View style={styles.cardGroup}>
            {filingHistory.map((f, i) => (
              <TouchableOpacity key={f.month} style={[styles.cardRow, i > 0 && styles.cardRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{f.label}</Text>
                  <Text style={styles.rowSub}>ITC: {formatRupee(f.itc)}</Text>
                </View>
                <View style={[styles.statusChip, f.color === 'accept' ? {backgroundColor: colors.severity.resolvedBg, borderColor: 'rgba(34,197,94,0.3)'} : {backgroundColor: colors.severity.pendingBg, borderColor: 'rgba(245,158,11,0.3)'}]}>
                  <Text style={[styles.statusChipText, f.color === 'accept' ? {color: colors.severity.resolved} : {color: colors.severity.pending}]}>{f.status}</Text>
                </View>
                <ChevronRight size={16} color={colors.inkMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx.settingsTitle}</Text>
          <View style={styles.cardGroup}>
            <View style={styles.cardRow}>
              <View style={styles.rowIconWrap}><Bell size={16} color={colors.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{tx.notifLabel}</Text>
                <Text style={styles.rowSub}>{tx.notifSub}</Text>
              </View>
              <Switch value={notifEnabled} onValueChange={setNotifEnabled} trackColor={{ false: colors.border, true: '#E8432A' }} thumbColor="#FFFFFF" />
            </View>
            <View style={styles.cardRowBorder} />
            <TouchableOpacity style={styles.cardRow} onPress={() => navigation.navigate('LockSetup')}>
              <View style={styles.rowIconWrap}><Lock size={16} color={colors.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{tx.pinLabel}</Text>
                <Text style={styles.rowSub}>{tx.pinSub}</Text>
              </View>
              <Switch value={lockEnabled} onValueChange={() => navigation.navigate('LockSetup')} trackColor={{ false: colors.border, true: '#E8432A' }} thumbColor="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.cardRowBorder} />
            <View style={styles.cardRow}>
              <View style={styles.rowIconWrap}><Languages size={16} color={colors.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{tx.langLabel}</Text>
                <Text style={styles.rowSub}>{tx.langSub}</Text>
              </View>
              <Switch value={lang === 'en'} onValueChange={toggle} trackColor={{ false: colors.primary, true: colors.primary }} thumbColor="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Help */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx.helpTitle}</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity style={styles.cardRow} onPress={() => Linking.openURL('https://www.gst.gov.in/')}>
              <View style={styles.rowIconWrap}><DownloadCloud size={16} color={colors.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{tx.exportLabel}</Text>
                <Text style={styles.rowSub}>{tx.exportSub}</Text>
              </View>
              <ChevronRight size={16} color={colors.inkMuted} />
            </TouchableOpacity>
            <View style={styles.cardRowBorder} />
            <TouchableOpacity style={styles.cardRow} onPress={() => Linking.openURL('https://www.gst.gov.in/')}>
              <View style={styles.rowIconWrap}><HelpCircle size={16} color={colors.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{tx.faqLabel}</Text>
                <Text style={styles.rowSub}>{tx.faqSub}</Text>
              </View>
              <ChevronRight size={16} color={colors.inkMuted} />
            </TouchableOpacity>
            <View style={styles.cardRowBorder} />
            <TouchableOpacity style={styles.cardRow} onPress={() => Linking.openURL('https://www.gst.gov.in/help/helpandcontacts')}>
              <View style={styles.rowIconWrap}><FileText size={16} color={colors.ink} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{tx.supportLabel}</Text>
                <Text style={styles.rowSub}>{tx.supportSub}</Text>
              </View>
              <ChevronRight size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Clear Data / Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleClearData} activeOpacity={0.8}>
          <LogOut size={16} color={colors.severity.blocked} strokeWidth={2.5} />
          <Text style={styles.logoutText}>{tx.logout}</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#E8432A',
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.primary,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  gstinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
    marginBottom: 6,
  },
  gstinLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  gstinValue: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: colors.ink,
  },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cycleText: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.inkMuted,
  },
  safeItcCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.severity.resolvedBg,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: radii.card,
    padding: spacing.md,
  },
  safeItcLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.severity.resolved,
    marginBottom: 4,
  },
  safeItcValue: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.severity.resolved,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  cardGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardRowBorder: {
    height: 1,
    backgroundColor: colors.border,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  rowSub: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  statusChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.severity.blockedBg,
    borderWidth: 1,
    borderColor: '#E0B0A5',
    paddingVertical: 16,
    borderRadius: radii.card,
    marginTop: spacing.sm,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.severity.blocked,
  },
});
