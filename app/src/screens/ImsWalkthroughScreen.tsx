import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ExternalLink,
  LogIn,
  Search,
  MousePointerClick,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { colors, typography, spacing, radii } from '../theme/tokens';
import { useI18n } from '../i18n/context';

interface StepProps {
  num: number;
  icon: React.ReactNode;
  title_en: string;
  title_hi: string;
  desc_en: string;
  desc_hi: string;
  lang: 'hi' | 'en';
}

function WalkthroughStep({ num, icon, title_en, title_hi, desc_en, desc_hi, lang }: StepProps) {
  return (
    <View style={styles.step}>
      <View style={styles.stepLeft}>
        <View style={styles.stepNumCircle}>
          <Text style={styles.stepNumText}>{num}</Text>
        </View>
        {num < 5 && <View style={styles.stepLine} />}
      </View>
      <View style={styles.stepContent}>
        <View style={styles.stepIconWrap}>{icon}</View>
        <Text style={styles.stepTitle}>{lang === 'hi' ? title_hi : title_en}</Text>
        <Text style={styles.stepDesc}>{lang === 'hi' ? desc_hi : desc_en}</Text>
      </View>
    </View>
  );
}

export default function ImsWalkthroughScreen() {
  const { lang } = useI18n();
  const navigation = useNavigation();

  const openPortal = () => {
    Linking.openURL('https://gst.gov.in').catch(() => {});
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
              <ChevronLeft size={22} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {lang === 'hi' ? 'IMS Portal Guide' : 'IMS Portal Guide'}
              </Text>
              <Text style={styles.headerSub}>
                {lang === 'hi' ? 'GST portal पर action कैसे लें' : 'How to take action on the GST portal'}
              </Text>
            </View>
          </View>
          <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Context card */}
        <View style={styles.contextCard}>
          <ShieldCheck size={20} color={colors.primary} />
          <Text style={styles.contextText}>
            {lang === 'hi'
              ? 'IMS (Invoice Management System) अप्रैल 2026 से अनिवार्य है। हर supplier invoice पर आपको Accept, Reject, या Hold करना होगा। यह app सिर्फ सलाह देता है — action आपको खुद GST portal पर लेना है।'
              : 'IMS (Invoice Management System) is mandatory since April 2026. You must Accept, Reject, or Hold every supplier invoice. This app only recommends — you must take the action yourself on the GST portal.'}
          </Text>
        </View>

        {/* Steps */}
        <Text style={styles.sectionLabel}>
          {lang === 'hi' ? 'स्टेप बाई स्टेप' : 'STEP BY STEP'}
        </Text>

        <WalkthroughStep
          num={1}
          icon={<LogIn size={20} color={colors.primary} />}
          title_en="Log in to the GST portal"
          title_hi="GST portal पर login करें"
          desc_en="Go to gst.gov.in → Click 'Login' → Enter your username, password, and OTP."
          desc_hi="gst.gov.in पर जाएं → 'Login' पर click करें → Username, password, और OTP डालें।"
          lang={lang}
        />

        <WalkthroughStep
          num={2}
          icon={<Search size={20} color={colors.severity.pending} />}
          title_en="Navigate to IMS"
          title_hi="IMS पर जाएं"
          desc_en="After login: Services → Returns → Invoice Management System (IMS). You'll see a list of all invoices your suppliers have filed."
          desc_hi="Login के बाद: Services → Returns → Invoice Management System (IMS)। आपके suppliers के सभी filed invoices की list दिखेगी।"
          lang={lang}
        />

        <WalkthroughStep
          num={3}
          icon={<MousePointerClick size={20} color={colors.inkMuted} />}
          title_en="Find the invoice"
          title_hi="Invoice ढूँढें"
          desc_en="Search by supplier GSTIN or invoice number. Match it with the recommendation from this app."
          desc_hi="Supplier GSTIN या invoice number से search करें। इस app की recommendation से match करें।"
          lang={lang}
        />

        <WalkthroughStep
          num={4}
          icon={<CheckCircle2 size={20} color={colors.severity.resolved} />}
          title_en="Take the action"
          title_hi="Action लें"
          desc_en="Select the invoice → Choose Accept, Reject, or Hold as recommended → Click Submit. You can change your choice until the GSTR-3B filing deadline."
          desc_hi="Invoice select करें → Accept, Reject, या Hold चुनें जैसा recommend किया → Submit करें। GSTR-3B deadline तक बदल सकते हैं।"
          lang={lang}
        />

        <WalkthroughStep
          num={5}
          icon={<ShieldCheck size={20} color={colors.primary} />}
          title_en="Confirm in GSTR-3B"
          title_hi="GSTR-3B में confirm करें"
          desc_en="When you file GSTR-3B, IMS actions are auto-applied. Accepted invoices become claimable ITC. Rejected ones are excluded."
          desc_hi="GSTR-3B file करते समय IMS actions अपने-आप apply हो जाते हैं। Accept की हुई invoices ITC में claim होंगी। Reject की हुई बाहर रहेंगी।"
          lang={lang}
        />

        {/* Warning card */}
        <View style={styles.warningCard}>
          <AlertTriangle size={18} color={colors.severity.pending} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>
              {lang === 'hi' ? 'कुछ न करें = Auto-Accept' : 'No action = Auto-Accept'}
            </Text>
            <Text style={styles.warningText}>
              {lang === 'hi'
                ? 'अगर आप IMS पर कोई action नहीं लेते, तो सभी invoices automatically Accept हो जाती हैं। गलत invoices के लिए Reject/Hold ज़रूर करें — वरना गलत ITC claim हो जाएगा।'
                : "If you take no action on IMS, all invoices are automatically accepted. Make sure to Reject/Hold incorrect invoices — otherwise you'll end up claiming wrong ITC."}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.portalButton} onPress={openPortal} activeOpacity={0.85}>
          <ExternalLink size={18} color="#FFFFFF" />
          <Text style={styles.portalButtonText}>
            {lang === 'hi' ? 'GST Portal खोलें' : 'Open GST Portal'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {lang === 'hi'
            ? 'यह app कोई action खुद नहीं लेता — सभी IMS actions आपको manually करने हैं।'
            : 'This app does not take any action automatically — all IMS actions must be done by you manually.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.ink },
  headerSub: { ...typography.caption, color: colors.inkMuted, marginTop: 1 },
  accentLine: { height: 2, borderRadius: 1, marginTop: spacing.sm, width: 40 },

  content: {
    padding: spacing.screenH,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },

  contextCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(255,59,59,0.2)',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  contextText: {
    ...typography.body,
    color: colors.inkSecondary,
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.lg,
  },

  // Steps
  step: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  stepLeft: {
    alignItems: 'center',
    width: 32,
    marginRight: spacing.sm,
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 4,
  },
  stepDesc: {
    ...typography.body,
    color: colors.inkSecondary,
    fontSize: 13,
    lineHeight: 20,
  },

  // Warning
  warningCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.severity.pendingBg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.severity.pending,
    marginBottom: 4,
  },
  warningText: {
    ...typography.body,
    color: colors.inkSecondary,
    fontSize: 13,
    lineHeight: 20,
  },

  // CTA
  portalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    height: 52,
    ...({
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    }),
  },
  portalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  disclaimer: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
