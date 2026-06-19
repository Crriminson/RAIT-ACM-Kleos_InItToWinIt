import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../components/AppText';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera as CameraIcon, X, RotateCcw, Check } from 'lucide-react-native';
import { colors, typography, spacing, radii } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { RootStackParamList } from '../navigation/types';

export default function CameraScreen() {
  const { t } = useI18n();
  const session = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [captured, setCaptured] = useState<CameraCapturedPicture | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Permission denied / not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <View style={styles.iconRing}>
            <CameraIcon size={40} color={colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>{t.camera.permissionTitle}</Text>
          <Text style={styles.permissionMessage}>{t.camera.permissionMessage}</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>{t.camera.grantPermission}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelLink}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo) setCaptured(photo);
    } catch (err) {
      // swallow — user can retry
    } finally {
      setBusy(false);
    }
  };

  const handleRetake = () => setCaptured(null);

  const handleUsePhoto = (addAnother: boolean) => {
    if (!captured) return;
    const fileName = `invoice-cam-${Date.now()}.jpg`;
    session.addInvoiceFiles([
      { uri: captured.uri, name: fileName, mimeType: 'image/jpeg' },
    ]);
    setCapturedCount((c) => c + 1);
    setCaptured(null);
    if (!addAnother) {
      navigation.goBack();
    }
  };

  // Review captured photo
  if (captured) {
    return (
      <SafeAreaView style={styles.reviewContainer}>
        <Image source={{ uri: captured.uri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.reviewActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRetake}>
            <RotateCcw size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{t.camera.retake}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => handleUsePhoto(true)}>
            <Check size={18} color={colors.surface} />
            <Text style={styles.primaryButtonText}>{t.camera.addAnother}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.doneLink} onPress={() => handleUsePhoto(false)}>
          <Text style={styles.doneLinkText}>{t.camera.usePhoto} & {t.camera.done}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Live camera
  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <X size={24} color={colors.surface} />
          </TouchableOpacity>
          {capturedCount > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{capturedCount} added</Text>
            </View>
          )}
        </View>

        {/* Frame guide */}
        <View style={styles.frameGuide} pointerEvents="none" />

        {/* Quality tips */}
        <View style={styles.tipsCard} pointerEvents="none">
          <Text style={styles.tipsTitle}>{t.camera.tipsTitle}</Text>
          <Text style={styles.tipLine}>• {t.camera.tip1}</Text>
          <Text style={styles.tipLine}>• {t.camera.tip2}</Text>
          <Text style={styles.tipLine}>• {t.camera.tip3}</Text>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <Text style={styles.hint}>{t.camera.hint}</Text>
          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={handleCapture}
            disabled={busy}
            activeOpacity={0.7}
          >
            <View style={styles.shutterInner}>
              {busy && <ActivityIndicator color={colors.primary} />}
            </View>
          </TouchableOpacity>
          {capturedCount > 0 ? (
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.bottomDone}>{t.camera.done}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.bottomSpacer} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Permission screen
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.recognitionBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  permissionTitle: {
    ...typography.heading2,
    color: colors.ink,
    textAlign: 'center',
  },
  permissionMessage: {
    ...typography.body,
    color: colors.inkSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radii.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
  },
  permissionButtonText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelLink: {
    paddingVertical: spacing.sm,
  },
  cancelLinkText: {
    ...typography.body,
    color: colors.inkMuted,
  },
  // Camera live view
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.badge,
  },
  countPillText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
  frameGuide: {
    alignSelf: 'center',
    width: '82%',
    aspectRatio: 0.75,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.card,
  },
  tipsCard: {
    position: 'absolute',
    bottom: 150,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  tipsTitle: { ...typography.caption, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: 2 },
  tipLine: { ...typography.caption, color: colors.surface, fontSize: 11 },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  hint: {
    ...typography.body,
    color: colors.surface,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.badge,
    overflow: 'hidden',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomDone: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
    fontSize: 15,
  },
  bottomSpacer: {
    height: 20,
  },
  // Review captured photo
  reviewContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'space-between',
  },
  preview: {
    flex: 1,
    width: '100%',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  doneLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  doneLinkText: {
    ...typography.body,
    color: colors.surface,
  },
});
