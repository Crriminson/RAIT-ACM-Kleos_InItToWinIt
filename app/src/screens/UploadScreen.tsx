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
  TrendingUp,
  MessageCircle,
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
              <View style={styles.heroBgBlob} />
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.greeting}>{greeting}</Text>
                  <Text style={styles.heroTitle}>
                    {profile?.shopName || 'Sharma Kirana Store'}
                  </Text>
                </View>
              </View>
              <Text style={styles.heroSub}>
                {lang === 'hi'
                  ? 'GST फाइलिंग से पहले अपने इनवॉइस जांचें।'
                  : "Let's check your invoices before filing GST."}
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
                    <Text style={[styles.deadlineDaysNum, isUrgent && { color: colors.severity.blocked }]}>
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

            {/* ITC saved nudge */}
            {totalChecks > 0 && (
              <View style={styles.itcNudge}>
                <View style={styles.itcNudgeIconWrap}>
                  <TrendingUp size={16} color={colors.severity.resolved} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itcNudgeLabel}>{lang === 'hi' ? 'पिछले महीने' : 'Last month'}</Text>
                  <Text style={styles.itcNudgeValue}>
                    {formatRupee(totalSaved)}{' '}
                    <Text style={styles.itcNudgeValueSub}>{lang === 'hi' ? 'गलतियों से बचाया गया ITC' : 'ITC saved from errors'}</Text>
                  </Text>
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
                      icon: <Camera size={14} color={colors.severity.pending} />,
                    },
                    {
                      num: '3',
                      text: lang === 'hi' ? 'ITC कितनी अटकी, तुरंत पता' : 'Instantly see blocked ITC',
                      icon: <Zap size={14} color={colors.severity.resolved} />,
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

            {/* WhatsApp bot entry */}
            <TouchableOpacity
              style={styles.whatsappEntry}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('WhatsAppDemo')}
            >
              <View style={styles.whatsappIconWrap}>
                <MessageCircle size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappTitle}>
                  {lang === 'hi' ? 'WhatsApp से invoice भेजें' : lang === 'mr' ? 'WhatsApp वरून invoice पाठवा' : 'Send invoice via WhatsApp'}
                </Text>
                <Text style={styles.whatsappSub}>
                  {lang === 'hi' ? 'फोटो भेजो, तुरंत ITC जाँच पाओ' : lang === 'mr' ? 'फोटो पाठवा, लगेच ITC तपासणी मिळवा' : 'Send a photo, get instant ITC check'}
                </Text>
              </View>
              <ArrowRight size={16} color="#25D366" />
            </TouchableOpacity>

            {/* Progress tracker */}
            <View style={styles.progressTracker}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, hasGstr2b ? styles.progressDotDone : styles.progressDotActive]}>
                  {hasGstr2b ? <CheckCircle size={14} color="#FFF" /> : <Text style={[styles.progressDotNum, hasGstr2b ? { color: '#FFF' } : {}]}>1</Text>}
                </View>
                <Text style={[styles.progressLabel, hasGstr2b ? styles.progressLabelDone : styles.progressLabelActive]}>
                  {lang === 'hi' ? 'GSTR-2B' : 'GSTR-2B'}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: hasGstr2b ? '100%' : '0%' }]} />
              </View>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, hasInvoices ? styles.progressDotDone : hasGstr2b ? styles.progressDotActive : styles.progressDotMuted]}>
                  {hasInvoices ? <CheckCircle size={14} color="#FFF" /> : <Text style={[styles.progressDotNum, (!hasInvoices && !hasGstr2b) ? { color: colors.inkMuted } : {}]}>2</Text>}
                </View>
                <Text style={[styles.progressLabel, hasInvoices ? styles.progressLabelDone : hasGstr2b ? styles.progressLabelActive : styles.progressLabelMuted]}>
                  {lang === 'hi' ? 'इनवॉइस' : 'Invoices'}
                </Text>
              </View>
            </View>

            {/* Step 1: GSTR-2B */}
            <View style={[styles.stepCard, hasGstr2b && styles.stepCardDone]}>
              <View style={styles.stepRowInner}>
                <View style={[styles.stepIconWrap, hasGstr2b ? {backgroundColor: 'rgba(42,92,50,0.15)'} : {backgroundColor: colors.surfaceRaised}]}>
                  {hasGstr2b ? <CheckCircle size={16} color={colors.severity.resolved} /> : <Text style={styles.stepNumTextInner}>1</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitleInner, hasGstr2b && {color: colors.severity.resolved}]}>
                    {lang === 'hi' ? 'अपना GSTR-2B अपलोड करें' : 'Upload your GSTR-2B'}
                  </Text>
                  <Text style={styles.stepSubInner}>
                    {lang === 'hi' ? 'GST पोर्टल से CSV या Excel फ़ाइल' : 'CSV or Excel from the GST portal'}
                  </Text>
                </View>
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
                <View style={{ alignItems: 'center' }}>
                  <FileSpreadsheet size={24} color={colors.inkMuted} style={{ marginBottom: 8 }} />
                  <Text style={styles.zoneHint}>{lang === 'hi' ? 'यहाँ टैप करके अपलोड करें' : 'Tap to upload CSV'}</Text>
                </View>
              </TouchableOpacity>
            )}
            </View>

            {/* Step 2: Invoices */}
            <View style={[styles.stepCard, hasInvoices && styles.stepCardDone, { marginTop: spacing.md }]}>
              <View style={styles.stepRowInner}>
                <View style={[styles.stepIconWrap, hasInvoices ? {backgroundColor: 'rgba(42,92,50,0.15)'} : {backgroundColor: colors.surfaceRaised}]}>
                  {hasInvoices ? <CheckCircle size={16} color={colors.severity.resolved} /> : <Text style={styles.stepNumTextInner}>2</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitleInner, hasInvoices && {color: colors.severity.resolved}]}>
                    {lang === 'hi' ? 'इनवॉइस फोटो या PDF जोड़ें' : 'Add invoice photos or PDFs'}
                  </Text>
                  <Text style={styles.stepSubInner}>
                    {lang === 'hi' ? 'एक साथ कई फ़ाइलें अपलोड करें' : 'Upload multiple files at once'}
                  </Text>
                </View>
              </View>

            <TouchableOpacity style={styles.uploadZone} activeOpacity={0.8} onPress={pickInvoices}>
              <View style={{ alignItems: 'center' }}>
                <FolderOpen size={24} color={colors.inkMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.zoneHint}>{lang === 'hi' ? 'यहाँ टैप करके अपलोड करें' : 'Tap to upload PDFs or Images'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.scanBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Camera')}>
              <Camera size={18} color={colors.ink} />
              <Text style={styles.scanBtnText}>{lang === 'hi' ? 'कैमरे से स्कैन करें' : 'Scan with camera'}</Text>
            </TouchableOpacity>

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
            </View>

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
  // Hero Blob
  heroBgBlob: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#C8DFC4',
    opacity: 0.4,
    zIndex: -1,
  },
  // ITC Nudge
  itcNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.severity.resolvedBg,
    borderWidth: 1,
    borderColor: colors.severity.resolvedBg,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    zIndex: 10,
  },
  itcNudgeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(42,92,50,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itcNudgeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.severity.resolved,
  },
  itcNudgeValue: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.severity.resolved,
  },
  itcNudgeValueSub: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.severity.resolved,
  },
  // Progress Tracker
  progressTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotDone: { backgroundColor: colors.severity.resolved },
  progressDotActive: { backgroundColor: colors.primary },
  progressDotMuted: { backgroundColor: colors.accentMuted },
  progressDotCheck: { fontSize: 12, color: '#FFFFFF', fontWeight: '800' },
  progressDotNum: { fontSize: 12, color: '#FFFFFF', fontWeight: '800' },
  progressLabel: { fontSize: 12, fontWeight: '600' },
  progressLabelDone: { color: colors.inkMuted },
  progressLabelActive: { color: colors.ink },
  progressLabelMuted: { color: colors.inkMuted },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 12,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.severity.resolved,
  },
  // Step Cards
  stepCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    ...elevation.soft,
  },
  stepCardDone: {
    backgroundColor: colors.severity.resolvedBg,
    borderColor: 'rgba(42,92,50,0.25)',
  },
  stepRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumTextInner: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.inkMuted,
  },
  stepTitleInner: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  stepSubInner: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
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

  // WhatsApp entry
  whatsappEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#25D366',
  },
  whatsappIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  whatsappSub: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.inkMuted,
    marginTop: 1,
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
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderHover,
    borderRadius: radii.card,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  zoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneLabel: { fontSize: 13, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  zoneHint: { ...typography.caption, color: colors.inkMuted, marginTop: 2, textAlign: 'center' },

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
    backgroundColor: 'rgba(42,92,50,0.1)',
    borderRadius: radii.button,
    padding: spacing.sm,
  },
  fileAcceptedIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'transparent',
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
