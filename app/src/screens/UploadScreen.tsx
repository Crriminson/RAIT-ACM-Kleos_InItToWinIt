import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { Text } from '../components/AppText';
import * as DocumentPicker from 'expo-document-picker';
import { readAssetText } from '../utils/file-read';
import { notify } from '../utils/dialog';
import {
  Camera,
  FileSpreadsheet,
  FolderOpen,
  CheckCircle,
  X,
  Sparkles,
  ArrowRight,
  Info,
  Images,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  Clock,
  IndianRupee,
  TrendingDown,
  Zap,
  ScanSearch,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useProfile } from '../data/contexts/profile-context';
import { useSession } from '../data/contexts/session-context';
import { parseGstr2bCsv } from '../data/parse-gstr2b-csv';
import { RootStackParamList } from '../navigation/types';
import GradientButton from '../components/GradientButton';

function formatRupee(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export default function UploadScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const { profile } = useProfile();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [showImages, setShowImages] = useState(false);

  // Fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const hasGstr2b = session.gstr2bFile !== null;
  const hasInvoices = session.invoiceFiles.length > 0;
  const canProceed = hasGstr2b && hasInvoices;

  const isRealImage = (f: { uri: string; name: string; mimeType?: string }) =>
    (f.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(f.name)) &&
    !f.uri.startsWith('demo://');

  const missingHint = !hasGstr2b && !hasInvoices
    ? (lang === 'hi' ? 'Step 1 और Step 2 दोनों पूरे करें' : 'Complete both Step 1 and Step 2')
    : !hasGstr2b
      ? (lang === 'hi' ? 'पहले GSTR-2B फ़ाइल अपलोड करें (Step 1)' : 'Upload your GSTR-2B file first (Step 1)')
      : (lang === 'hi' ? 'कम से कम एक invoice जोड़ें (Step 2)' : 'Add at least one invoice (Step 2)');

  const pickGstr2b = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '*/*',
        ],
        copyToCacheDirectory: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const csvText = await readAssetText(asset);
      const entries = csvText ? parseGstr2bCsv(csvText) : [];
      if (entries.length === 0) {
        notify(
          lang === 'hi' ? 'फ़ाइल पढ़ी नहीं गई' : 'Could not read entries',
          lang === 'hi'
            ? 'CSV में कोई entry नहीं मिली। सही GSTR-2B CSV चुनें।'
            : 'No entries found. Please pick a valid GSTR-2B CSV.',
        );
        return;
      }
      session.setGstr2bFile(
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? undefined },
        entries,
      );
    } catch (err: any) {
      notify('Could not read file', String(err?.message ?? err));
    }
  };

  const pickInvoices = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: false,
      });
      if (result.canceled || !result.assets) return;
      const files = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType ?? undefined,
      }));
      session.addInvoiceFiles(files);
    } catch {
      notify('Error', 'Could not pick files. Please try again.');
    }
  };

  const handleStart = () => {
    session.startReview();
    navigation.navigate('Review');
  };

  const greeting = profile?.shopName
    ? (lang === 'hi' ? `नमस्ते, ${profile.shopName}` : `Hello, ${profile.shopName}`)
    : (lang === 'hi' ? 'नमस्ते' : 'Hello');

  const lastRun = session.history[0];
  const totalChecks = session.history.length;
  const totalSaved = session.history.reduce((sum, r) => sum + r.totalResolved, 0);
  const totalBlocked = session.history.reduce((sum, r) => sum + r.totalBlocked, 0);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={['top']}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Hero header */}
            <View style={styles.heroSection}>
              <View style={styles.heroTop}>
                <Text style={styles.greeting}>{greeting}</Text>
                <View style={styles.brandBadge}>
                  <ScanSearch size={18} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.heroTitle}>
                {lang === 'hi' ? 'GST जाँच शुरू\nकरें' : "Start your\nGST check"}
              </Text>
              <Text style={styles.heroSub}>
                {lang === 'hi'
                  ? 'Invoices upload करें — ITC कितनी अटकी है, 2 मिनट में पता करें'
                  : 'Upload invoices — find out how much ITC is blocked in 2 minutes'}
              </Text>
            </View>

            {/* GSTR-3B deadline countdown */}
            {(() => {
              const now = new Date();
              const deadlineDay = 20;
              const deadlineMonth = now.getDate() > deadlineDay ? now.getMonth() + 1 : now.getMonth();
              const deadlineYear = deadlineMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
              const deadline = new Date(deadlineYear, deadlineMonth > 11 ? 0 : deadlineMonth, deadlineDay);
              const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const deadlineLabel = `${deadlineDay} ${monthNames[deadline.getMonth()]}`;
              const isUrgent = daysLeft <= 5;

              return (
                <View style={[styles.deadlineBanner, isUrgent && styles.deadlineBannerUrgent]}>
                  <View style={[styles.deadlineDays, isUrgent && styles.deadlineDaysUrgent]}>
                    <Text style={[styles.deadlineDaysNum, isUrgent && { color: colors.error }]}>
                      {daysLeft}
                    </Text>
                    <Text style={styles.deadlineDaysLabel}>
                      {lang === 'hi' ? 'दिन' : 'days'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deadlineTitle}>
                      {lang === 'hi'
                        ? `GSTR-3B deadline: ${deadlineLabel}`
                        : `GSTR-3B due: ${deadlineLabel}`}
                    </Text>
                    <Text style={styles.deadlineSub}>
                      {lang === 'hi'
                        ? 'IMS actions इससे पहले पूरे करें'
                        : 'Complete IMS actions before this date'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Stats row — returning users */}
            {totalChecks > 0 && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {formatRupee(totalSaved)}
                  </Text>
                  <Text style={styles.statLabel}>{lang === 'hi' ? 'ITC सुरक्षित' : 'ITC safe'}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: colors.error }]}>
                    {formatRupee(totalBlocked)}
                  </Text>
                  <Text style={styles.statLabel}>{lang === 'hi' ? 'ITC अटकी' : 'ITC blocked'}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: colors.ink }]}>{totalChecks}</Text>
                  <Text style={styles.statLabel}>{lang === 'hi' ? 'जाँचें' : 'checks'}</Text>
                </View>
              </View>
            )}

            {/* First-time onboarding card */}
            {totalChecks === 0 && !session.gstr2bFile && session.invoiceFiles.length === 0 && (
              <View style={styles.onboardCard}>
                <View style={styles.onboardSteps}>
                  {[
                    {
                      num: '1',
                      text: lang === 'hi' ? 'GSTR-2B CSV अपलोड करें' : 'Upload your GSTR-2B CSV',
                      icon: <FileSpreadsheet size={14} color={colors.primary} />,
                    },
                    {
                      num: '2',
                      text: lang === 'hi' ? 'Invoices जोड़ें (photo/file)' : 'Add invoices (photo/file)',
                      icon: <Camera size={14} color={colors.warning} />,
                    },
                    {
                      num: '3',
                      text: lang === 'hi' ? 'ITC कितनी अटकी, तुरंत पता' : 'Instantly see blocked ITC',
                      icon: <Zap size={14} color={colors.success} />,
                    },
                  ].map((step) => (
                    <View key={step.num} style={styles.onboardStep}>
                      <View style={styles.onboardStepIcon}>{step.icon}</View>
                      <Text style={styles.onboardStepText}>{step.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Demo shortcut */}
            {!session.gstr2bFile && session.invoiceFiles.length === 0 && (
              <TouchableOpacity style={styles.demoButton} activeOpacity={0.85} onPress={() => session.loadDemo()}>
                <View style={styles.demoIconWrap}>
                  <Sparkles size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoButtonTitle}>
                    {lang === 'hi' ? 'Demo data से देखें' : 'Try with demo data'}
                  </Text>
                  <Text style={styles.demoButtonSub}>
                    {lang === 'hi' ? '8 invoices · तुरंत results' : '8 invoices · instant results'}
                  </Text>
                </View>
                <ArrowRight size={16} color={colors.inkMuted} />
              </TouchableOpacity>
            )}

            {/* Section label */}
            <Text style={styles.sectionLabel}>
              {lang === 'hi' ? 'अपलोड करें' : 'UPLOAD'}
            </Text>

            {/* Step 1: GSTR-2B */}
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepTitle}>
                {lang === 'hi' ? 'GSTR-2B अपलोड करें' : 'Upload GSTR-2B'}
              </Text>
            </View>

            {session.gstr2bFile ? (
              <View style={styles.fileAccepted}>
                <View style={styles.fileAcceptedIcon}>
                  <CheckCircle size={22} color={colors.severity.resolved} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileAcceptedName} numberOfLines={1}>{session.gstr2bFile.name}</Text>
                  <Text style={styles.fileAcceptedDetail}>
                    {session.gstr2bEntries.length} {lang === 'hi' ? 'entries मिलीं' : 'entries found'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => session.reset()} hitSlop={8} style={styles.removeBtn}>
                  <X size={18} color={colors.inkMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadZone} activeOpacity={0.8} onPress={pickGstr2b}>
                <View style={[styles.zoneIcon, { backgroundColor: colors.accentMuted }]}>
                  <FileSpreadsheet size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneLabel}>{t.upload.gstr2bLabel}</Text>
                  <Text style={styles.zoneHint}>{t.upload.gstr2bHint}</Text>
                </View>
                <ArrowRight size={16} color={colors.inkMuted} />
              </TouchableOpacity>
            )}

            {/* Step 2: Invoices */}
            <View style={[styles.stepRow, { marginTop: spacing.lg }]}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepTitle}>
                {lang === 'hi' ? 'Invoices जोड़ें' : 'Add invoices'}
              </Text>
              {session.invoiceFiles.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{session.invoiceFiles.length}</Text>
                </View>
              )}
            </View>

            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadZoneCompact} activeOpacity={0.8} onPress={pickInvoices}>
                <View style={[styles.zoneIconSmall, { backgroundColor: colors.severity.resolvedBg }]}>
                  <FolderOpen size={20} color={colors.severity.resolved} />
                </View>
                <Text style={styles.zoneLabelSmall}>{t.upload.invoiceFileLabel}</Text>
                <Text style={styles.zoneHintSmall}>{t.upload.invoiceFileHint}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadZoneCompact} activeOpacity={0.8} onPress={() => navigation.navigate('Camera')}>
                <View style={[styles.zoneIconSmall, { backgroundColor: colors.severity.pendingBg }]}>
                  <Camera size={20} color={colors.severity.pending} />
                </View>
                <Text style={styles.zoneLabelSmall}>{t.upload.invoiceCameraLabel}</Text>
                <Text style={styles.zoneHintSmall}>{t.upload.invoiceCameraHint}</Text>
              </TouchableOpacity>
            </View>

            {/* Uploaded invoices preview */}
            {hasInvoices && (
              <View style={styles.previewCard}>
                <TouchableOpacity
                  style={styles.previewHeader}
                  activeOpacity={0.7}
                  onPress={() => setShowImages((v) => !v)}
                >
                  <View style={styles.previewHeaderLeft}>
                    <View style={styles.previewIcon}>
                      <Images size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.previewTitle}>
                      {session.invoiceFiles.length}{' '}
                      {lang === 'hi' ? 'invoices जोड़ी गईं' : 'invoices added'}
                    </Text>
                  </View>
                  <View style={styles.previewToggle}>
                    <Text style={styles.previewToggleText}>
                      {showImages
                        ? (lang === 'hi' ? 'छुपाएं' : 'Hide')
                        : (lang === 'hi' ? 'देखें' : 'View')}
                    </Text>
                    {showImages ? (
                      <ChevronUp size={16} color={colors.primary} />
                    ) : (
                      <ChevronDown size={16} color={colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>

                {showImages && (
                  <View style={styles.thumbGrid}>
                    {session.invoiceFiles.map((f) => (
                      <View key={f.uri} style={styles.thumbWrap}>
                        {isRealImage(f) ? (
                          <Image source={{ uri: f.uri }} style={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, styles.thumbPlaceholder]}>
                            <FileText size={20} color={colors.inkMuted} />
                            <Text style={styles.thumbName} numberOfLines={1}>
                              {f.name.replace(/\.[^.]+$/, '')}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.thumbRemove}
                          onPress={() => session.removeInvoiceFile(f.uri)}
                          hitSlop={6}
                        >
                          <X size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <GradientButton
              label={
                canProceed
                  ? `${session.gstr2bEntries.length} + ${session.invoiceFiles.length} ${t.upload.ready}`
                  : t.upload.startChecking
              }
              disabled={!canProceed}
              onPress={handleStart}
              icon={canProceed ? <ArrowRight size={20} color="#FFFFFF" /> : undefined}
              style={{ marginTop: spacing.xl }}
            />

            {!canProceed && (
              <View style={styles.hintRow}>
                <Info size={14} color={colors.inkMuted} />
                <Text style={styles.hintText}>{missingHint}</Text>
              </View>
            )}

            {/* Bottom breathing room */}
            <View style={{ height: spacing.xl }} />
          </Animated.View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.xl,
  },

  // Hero
  heroSection: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,59,59,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 42,
    marginTop: spacing.md,
    letterSpacing: -0.5,
  },
  heroSub: {
    ...typography.body,
    color: colors.inkSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  // Deadline banner
  deadlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deadlineBannerUrgent: {
    backgroundColor: colors.severity.blockedBg,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  deadlineDays: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deadlineDaysUrgent: {
    backgroundColor: 'rgba(255,68,68,0.15)',
  },
  deadlineDaysNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 22,
  },
  deadlineDaysLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deadlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  deadlineSub: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Onboarding card
  onboardCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  onboardSteps: { gap: spacing.md },
  onboardStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  onboardStepIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardStepText: {
    ...typography.body,
    color: colors.inkSecondary,
    fontSize: 14,
    flex: 1,
  },

  // Demo button
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,59,59,0.2)',
  },
  demoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  demoButtonSub: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.inkMuted,
    marginTop: 1,
  },

  // Section
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Upload zones — full width
  uploadZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  zoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  zoneHint: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },

  // Upload zones — compact 2-col
  uploadRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  uploadZoneCompact: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  zoneIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  zoneLabelSmall: { fontSize: 13, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  zoneHintSmall: { fontSize: 11, color: colors.inkMuted, textAlign: 'center' },

  // File accepted
  fileAccepted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.severity.resolvedBg,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: radii.card,
    padding: spacing.md,
  },
  fileAcceptedIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileAcceptedName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  fileAcceptedDetail: {
    ...typography.caption,
    color: colors.severity.resolved,
    marginTop: 2,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hint
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  hintText: { ...typography.caption, color: colors.inkMuted },

  // Preview
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  previewHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewToggleText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  thumbName: {
    fontSize: 8,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  thumbRemove: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.severity.blocked,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
