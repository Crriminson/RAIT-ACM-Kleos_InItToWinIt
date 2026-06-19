import React from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { Text } from '../components/AppText';
import { Languages, Clock, ChevronRight, Building2, Trash2, ShieldCheck, CheckCircle2, MessageCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radii } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { useProfile } from '../data/contexts/profile-context';
import { useLock } from '../data/contexts/lock-context';
import { confirmAction } from '../utils/dialog';
import { RootStackParamList } from '../navigation/types';

export default function ProfileScreen() {
  const { t, lang, toggle } = useI18n();
  const session = useSession();
  const { profile } = useProfile();
  const { enabled: lockEnabled } = useLock();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const runCount = session.history.length;
  const initials = (profile?.shopName ?? 'CA').trim().slice(0, 2).toUpperCase();

  const handleClearData = () => {
    confirmAction(
      t.profile.clearData,
      lang === 'hi' ? 'सारा local data हट जाएगा। पक्का?' : 'All local data will be removed. Are you sure?',
      () => session.clearAll(),
      {
        confirmLabel: t.profile.clearData,
        cancelLabel: lang === 'hi' ? 'रद्द करें' : 'Cancel',
        destructive: true,
      },
    );
  };

  return (
    <View style={styles.root}>
      {/* Dark header with avatar */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.shopName}>
              {profile?.shopName || (lang === 'hi' ? 'आपकी दुकान' : 'Your shop')}
            </Text>
            <Text style={styles.gstinSmall}>
              {profile?.gstin ?? (lang === 'hi' ? 'GSTIN नहीं डाला' : 'No GSTIN yet')}
            </Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconChip, { backgroundColor: colors.accentMuted }]}>
              <Languages size={20} color={colors.primary} />
            </View>
            <Text style={styles.rowLabel}>{t.profile.language}</Text>
            <View style={styles.langToggle}>
              <Text style={[styles.langOption, lang === 'hi' && styles.langOptionActive]}>हिंदी</Text>
              <Switch
                value={lang === 'en'}
                onValueChange={toggle}
                trackColor={{ false: colors.primary, true: colors.primary }}
                thumbColor={colors.ink}
              />
              <Text style={[styles.langOption, lang === 'en' && styles.langOptionActive]}>EN</Text>
            </View>
          </View>
        </View>

        {/* GSTIN */}
        <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('GstinSetup', { mode: 'edit' })}>
          <View style={styles.row}>
            <View style={[styles.iconChip, { backgroundColor: colors.severity.resolvedBg }]}>
              <Building2 size={20} color={colors.severity.resolved} />
            </View>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabelPlain}>{t.profile.gstin}</Text>
              <Text style={profile ? styles.cardValue : styles.cardValueMuted}>
                {profile?.gstin ?? (lang === 'hi' ? 'डालने के लिए tap करें' : 'Tap to add')}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.inkMuted} />
          </View>
        </TouchableOpacity>

        {/* App lock */}
        <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('LockSetup')}>
          <View style={styles.row}>
            <View style={[styles.iconChip, { backgroundColor: colors.accentMuted }]}>
              <ShieldCheck size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabelPlain}>{t.lock.appLock}</Text>
              <Text style={styles.cardValueMuted}>
                {lockEnabled ? t.lock.enabled : t.lock.appLockSub}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.inkMuted} />
          </View>
        </TouchableOpacity>

        {/* WhatsApp bot (channel prototype) */}
        <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('WhatsAppDemo')}>
          <View style={styles.row}>
            <View style={[styles.iconChip, { backgroundColor: colors.severity.resolvedBg }]}>
              <MessageCircle size={20} color="#25D366" />
            </View>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabelPlain}>{lang === 'hi' ? 'WhatsApp बॉट' : 'WhatsApp bot'}</Text>
              <Text style={styles.cardValueMuted}>
                {lang === 'hi' ? 'प्रोटोटाइप — invoice भेजकर जाँच' : 'Prototype — send an invoice to check'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.inkMuted} />
          </View>
        </TouchableOpacity>

        {/* Session history */}
        <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('History')}>
          <View style={styles.row}>
            <View style={[styles.iconChip, { backgroundColor: colors.severity.pendingBg }]}>
              <Clock size={20} color={colors.severity.pending} />
            </View>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabelPlain}>{t.profile.sessionHistory}</Text>
              <Text style={styles.cardValueMuted}>
                {runCount === 0
                  ? (lang === 'hi' ? 'अभी तक कोई जाँच नहीं' : 'No checks yet')
                  : `${runCount} ${lang === 'hi' ? 'जाँच' : runCount === 1 ? 'check' : 'checks'}`}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.inkMuted} />
          </View>
        </TouchableOpacity>

        {/* About / how it helps */}
        <View style={styles.aboutCard}>
          <View style={styles.row}>
            <View style={[styles.iconChip, { backgroundColor: colors.accentMuted }]}>
              <ShieldCheck size={20} color={colors.primary} />
            </View>
            <Text style={styles.aboutTitle}>{t.profile.aboutTitle}</Text>
          </View>
          <Text style={styles.aboutBody}>{t.profile.aboutBody}</Text>
          {[t.profile.point1, t.profile.point2, t.profile.point3].map((p) => (
            <View key={p} style={styles.pointRow}>
              <CheckCircle2 size={16} color={colors.severity.resolved} style={{ marginTop: 2 }} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.clearButton} onPress={handleClearData} activeOpacity={0.8}>
          <Trash2 size={18} color={colors.error} />
          <Text style={styles.clearButtonText}>{t.profile.clearData}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{t.profile.version} 1.0.0 · KLEOS 2026</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: { alignItems: 'center', paddingTop: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: colors.ink },
  shopName: { fontSize: 20, fontWeight: '800', color: colors.ink },
  gstinSmall: {
    ...typography.caption,
    color: colors.inkMuted,
    marginTop: 4,
  },

  content: {
    padding: spacing.screenH,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { ...typography.bodyBold, color: colors.ink, flex: 1 },
  rowTextBlock: { flex: 1, gap: 2 },
  rowLabelPlain: { ...typography.bodyBold, color: colors.ink },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langOption: { ...typography.label, color: colors.inkMuted },
  langOptionActive: { color: colors.primary, fontWeight: '700' },
  cardValue: { ...typography.body, color: colors.inkSecondary },
  cardValueMuted: { ...typography.body, color: colors.inkMuted },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radii.button,
    paddingVertical: 14,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  clearButtonText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },
  version: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },

  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aboutTitle: { ...typography.heading2, color: colors.ink, flex: 1 },
  aboutBody: {
    ...typography.body,
    color: colors.inkSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    fontSize: 14,
  },
  pointRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pointText: { ...typography.body, color: colors.ink, flex: 1, fontSize: 14 },
});
