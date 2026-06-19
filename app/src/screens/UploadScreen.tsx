import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Text } from '../components/AppText';
import * as DocumentPicker from 'expo-document-picker';
import { readAssetText } from '../utils/file-read';
import { notify } from '../utils/dialog';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, elevation, gradients } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useProfile } from '../data/contexts/profile-context';
import { useSession } from '../data/contexts/session-context';
import { parseGstr2bCsv } from '../data/parse-gstr2b-csv';
import { RootStackParamList } from '../navigation/types';
import GradientButton from '../components/GradientButton';

export default function UploadScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const { profile } = useProfile();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [showImages, setShowImages] = useState(false);

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
        // Read the content:// URI directly (ContentResolver) instead of a cached
        // copy — avoids the Expo Go sandbox "isn't readable" error on Android.
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
        // Read the original content:// URI via ContentResolver instead of a
        // cached copy — avoids the Expo Go "isn't readable" error on Android.
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
    : (lang === 'hi' ? 'नमस्ते 👋' : 'Hello 👋');

  return (
    <View style={styles.root}>
      {/* Gradient header */}
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.headerTitle}>
            {lang === 'hi' ? 'इस महीने की जाँच शुरू करें' : "Start this month's check"}
          </Text>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Demo shortcut */}
        {!session.gstr2bFile && session.invoiceFiles.length === 0 && (
          <TouchableOpacity style={styles.demoButton} activeOpacity={0.85} onPress={() => session.loadDemo()}>
            <Sparkles size={18} color={colors.primary} />
            <Text style={styles.demoButtonText}>
              {lang === 'hi' ? 'Demo data से देखें' : 'Try with demo data'}
            </Text>
            <ArrowRight size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

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
            <View style={[styles.zoneIcon, { backgroundColor: colors.recognitionBg }]}>
              <FileSpreadsheet size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.zoneLabel}>{t.upload.gstr2bLabel}</Text>
              <Text style={styles.zoneHint}>{t.upload.gstr2bHint}</Text>
            </View>
            <ArrowRight size={18} color={colors.inkMuted} />
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

        <TouchableOpacity style={styles.uploadZone} activeOpacity={0.8} onPress={pickInvoices}>
          <View style={[styles.zoneIcon, { backgroundColor: '#EEF6EE' }]}>
            <FolderOpen size={24} color={colors.severity.resolved} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.zoneLabel}>{t.upload.invoiceFileLabel}</Text>
            <Text style={styles.zoneHint}>{t.upload.invoiceFileHint}</Text>
          </View>
          <ArrowRight size={18} color={colors.inkMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadZone, { marginTop: spacing.sm }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Camera')}
        >
          <View style={[styles.zoneIcon, { backgroundColor: '#FFF3E8' }]}>
            <Camera size={24} color={colors.severity.pending} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.zoneLabel}>{t.upload.invoiceCameraLabel}</Text>
            <Text style={styles.zoneHint}>{t.upload.invoiceCameraHint}</Text>
          </View>
          <ArrowRight size={18} color={colors.inkMuted} />
        </TouchableOpacity>

        {/* Uploaded invoices preview — collapsed by default */}
        {hasInvoices && (
          <View style={styles.previewCard}>
            <TouchableOpacity
              style={styles.previewHeader}
              activeOpacity={0.7}
              onPress={() => setShowImages((v) => !v)}
            >
              <View style={styles.previewHeaderLeft}>
                <View style={styles.previewIcon}>
                  <Images size={18} color={colors.primary} />
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
                      <X size={12} color={colors.surface} />
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
          icon={canProceed ? <ArrowRight size={20} color={colors.surface} /> : undefined}
          style={{ marginTop: spacing.xl }}
        />

        {!canProceed && (
          <View style={styles.hintRow}>
            <Info size={14} color={colors.inkMuted} />
            <Text style={styles.hintText}>{missingHint}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...elevation.card,
  },
  greeting: { ...typography.label, color: 'rgba(255,255,255,0.85)', marginTop: spacing.sm },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.surface, marginTop: 4, letterSpacing: -0.3 },

  scroll: { flex: 1 },
  contentContainer: { padding: spacing.screenH, paddingTop: spacing.lg, paddingBottom: spacing.xl },

  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.recognitionBg,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(4,94,254,0.2)',
  },
  demoButtonText: { ...typography.label, color: colors.primary, fontWeight: '700', flex: 1 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { ...typography.caption, color: colors.surface, fontWeight: '800' },
  stepTitle: { ...typography.heading2, color: colors.ink, flex: 1 },
  countBadge: {
    minWidth: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: { ...typography.caption, color: colors.surface, fontWeight: '800' },

  uploadZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    ...elevation.soft,
  },
  zoneIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  zoneLabel: { ...typography.bodyBold, color: colors.ink },
  zoneHint: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },

  fileAccepted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.severity.resolvedBg,
    borderWidth: 1,
    borderColor: 'rgba(46,125,50,0.3)',
    borderRadius: radii.card,
    padding: spacing.md,
  },
  fileAcceptedIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  fileAcceptedName: { ...typography.bodyBold, color: colors.ink },
  fileAcceptedDetail: { ...typography.caption, color: colors.severity.resolved, marginTop: 2 },
  removeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  hintText: { ...typography.caption, color: colors.inkMuted },

  // Uploaded invoices preview
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    ...elevation.soft,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  previewHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.recognitionBg,
    justifyContent: 'center', alignItems: 'center',
  },
  previewTitle: { ...typography.bodyBold, color: colors.ink },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewToggleText: { ...typography.label, color: colors.primary, fontWeight: '700' },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.thumbnail,
    backgroundColor: colors.background,
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  thumbName: { ...typography.caption, fontSize: 9, color: colors.inkMuted, textAlign: 'center' },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.severity.blocked,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
