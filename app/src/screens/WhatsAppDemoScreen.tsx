import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, Paperclip, Info, Volume2, VolumeX } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { useI18n } from '../i18n/context';
import { useProfile } from '../data/contexts/profile-context';
import { useSession } from '../data/contexts/session-context';
import { extractInvoiceFromFile } from '../data/extraction';
import { runDiagnosis } from '../data/matching-engine';
import { mockGstr2b } from '../data/mock-gstr2b';
import { mockInvoices } from '../data/mock-invoices';
import { Invoice, DiagnosisResult } from '../data/types';
import { speak, stopSpeaking } from '../utils/speech';
import { notify } from '../utils/dialog';
import { spacing, radii } from '../theme/tokens';

// WhatsApp brand palette — this screen deliberately mimics the channel.
const WA = {
  header: '#075E54',
  accent: '#25D366',
  chatBg: '#ECE5DD',
  botBubble: '#FFFFFF',
  userBubble: '#DCF8C6',
  ink: '#0B141A',
  inkMuted: '#667781',
};

const DEMO_INVOICE = require('../../assets/whatsapp-demo-invoice.png');

const formatRupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

type Msg =
  | { id: string; from: 'bot' | 'user'; kind: 'text'; text: string }
  | { id: string; from: 'user'; kind: 'image'; uri: string; name: string }
  | { id: string; from: 'bot'; kind: 'typing' }
  | { id: string; from: 'bot'; kind: 'verdict'; text: string; speakText: string };

let seq = 0;
const nid = () => `m${seq++}`;

export default function WhatsAppDemoScreen() {
  const { lang } = useI18n();
  const { profile } = useProfile();
  const session = useSession();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Greeting on mount.
  useEffect(() => {
    setMessages([
      {
        id: nid(),
        from: 'bot',
        kind: 'text',
        text:
          lang === 'hi'
            ? 'नमस्ते! 👋 किसी भी invoice की फोटो यहाँ भेजें — मैं उसकी GST जाँच करके बताऊँगा कि ITC अटकी तो नहीं।'
            : "Namaste! 👋 Send a photo of any invoice here and I'll check its GST and tell you if any ITC is blocked.",
      },
    ]);
    return () => stopSpeaking();
  }, [lang]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages]);

  const buildVerdict = (r: DiagnosisResult) => {
    const sev = r.severity;
    const emoji = sev === 'blocked' ? '🔴' : sev === 'pending' ? '🟡' : '🟢';
    const word =
      lang === 'hi'
        ? sev === 'blocked'
          ? 'ITC अटकी है'
          : sev === 'pending'
            ? 'follow-up चाहिए'
            : 'सही match'
        : sev === 'blocked'
          ? 'ITC blocked'
          : sev === 'pending'
            ? 'needs follow-up'
            : 'matched';
    const reason = lang === 'hi' ? r.reason_hi : r.reason_en;
    const action = lang === 'hi' ? r.action_hi : r.action_en;
    const disclaimer =
      lang === 'hi'
        ? '⚠️ यह सलाह है — action खुद IMS portal पर लें।'
        : '⚠️ This is a recommendation — take the action yourself on the IMS portal.';

    const text =
      `🧾 ${r.supplierName} · ${r.invoiceNumber}\n` +
      `${emoji} ${formatRupee(r.amount)} ${word}\n\n` +
      `${reason}\n\n` +
      (sev !== 'resolved' ? `👉 ${action}\n\n` : '') +
      disclaimer;
    const speakText = `${formatRupee(r.amount)} ${word}. ${reason}${sev !== 'resolved' ? ' ' + action : ''}`;
    return { text, speakText };
  };

  // Core: push the picked image into the chat and run the REAL pipeline on it.
  const sendInvoice = async (file: PickedFile) => {
    if (busy) return;
    setBusy(true);

    setMessages((m) => [...m, { id: nid(), from: 'user', kind: 'image', uri: file.uri, name: file.name }]);
    const typingId = nid();
    setMessages((m) => [...m, { id: typingId, from: 'bot', kind: 'typing' }]);

    // Match against the user's imported GSTR-2B if they've loaded one, else the demo set.
    const gstr2b = session.gstr2bEntries.length > 0 ? session.gstr2bEntries : mockGstr2b;

    // Real pipeline: backend OCR (extractInvoiceFromFile) → matching engine.
    let result: DiagnosisResult | undefined;
    let usedFallback = false;
    try {
      const { invoice } = await extractInvoiceFromFile(file, `wa-${Date.now()}`, profile?.gstin);
      result = runDiagnosis([invoice], gstr2b)[0];
    } catch {
      // Demo-safe: still run the real matching engine on a known invoice so a
      // verdict always appears even if the backend OCR is unreachable.
      usedFallback = true;
      const fb: Invoice = mockInvoices.find((i) => /ramesh/i.test(i.supplierName)) ?? mockInvoices[0];
      result = runDiagnosis([fb], gstr2b)[0];
    }

    setMessages((m) => m.filter((x) => x.id !== typingId));
    if (result) {
      const { text, speakText } = buildVerdict(result);
      const prefix = usedFallback
        ? (lang === 'hi'
            ? '⚠️ अभी server से connect नहीं हो पाया — demo invoice दिखा रहा हूँ:\n\n'
            : "⚠️ Couldn't reach the server right now — showing a demo invoice:\n\n")
        : '';
      setMessages((m) => [...m, { id: nid(), from: 'bot', kind: 'verdict', text: prefix + text, speakText }]);
    }
    setBusy(false);
  };

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: false,
        // Read the original content:// URI via ContentResolver instead of a
        // cached copy — avoids the Expo Go "isn't readable" error on Android.
        copyToCacheDirectory: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      await sendInvoice({ uri: a.uri, name: a.name ?? 'invoice.jpg', mimeType: a.mimeType ?? undefined });
    } catch {
      notify(lang === 'hi' ? 'फ़ाइल नहीं चुनी जा सकी' : 'Could not pick a file');
    }
  };

  const handleSample = async () => {
    try {
      const asset = Asset.fromModule(DEMO_INVOICE);
      await asset.downloadAsync();
      await sendInvoice({ uri: asset.localUri ?? asset.uri, name: 'sample-invoice.png', mimeType: 'image/png' });
    } catch {
      notify(lang === 'hi' ? 'sample invoice load नहीं हुआ' : 'Could not load the sample invoice');
    }
  };

  const toggleSpeak = (id: string, text: string) => {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    speak(text, lang, {
      onStart: () => setSpeakingId(id),
      onDone: () => setSpeakingId(null),
    });
  };

  return (
    <View style={styles.root}>
      {/* WhatsApp-style header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: WA.header }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>CA</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>CA in Your Pocket</Text>
            <Text style={styles.headerStatus}>{lang === 'hi' ? 'ऑनलाइन' : 'online'}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Prototype disclosure — required by the design doc */}
      <View style={styles.disclosure}>
        <Info size={13} color={WA.inkMuted} />
        <Text style={styles.disclosureText}>
          {lang === 'hi'
            ? 'प्रोटोटाइप — असली WhatsApp Business API नहीं। यह channel का demo है।'
            : 'Prototype — not a live WhatsApp Business API. A demo of the ingestion channel.'}
        </Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
        {messages.map((m) => {
          if (m.kind === 'typing') {
            return (
              <View key={m.id} style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
                <ActivityIndicator size="small" color={WA.inkMuted} />
                <Text style={styles.typingText}>{lang === 'hi' ? 'invoice पढ़ रहा हूँ…' : 'Reading invoice…'}</Text>
              </View>
            );
          }
          if (m.kind === 'image') {
            return (
              <View key={m.id} style={[styles.bubble, styles.userBubble]}>
                <Image source={{ uri: m.uri }} style={styles.invoiceThumb} resizeMode="cover" />
                <Text style={styles.caption}>{m.name}</Text>
              </View>
            );
          }
          const isBot = m.from === 'bot';
          return (
            <View key={m.id} style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
              <Text style={styles.bubbleText}>{m.text}</Text>
              {m.kind === 'verdict' && (
                <TouchableOpacity
                  style={styles.speakRow}
                  onPress={() => toggleSpeak(m.id, m.speakText)}
                  hitSlop={8}
                >
                  {speakingId === m.id ? (
                    <VolumeX size={16} color={WA.header} />
                  ) : (
                    <Volume2 size={16} color={WA.header} />
                  )}
                  <Text style={styles.speakText}>
                    {speakingId === m.id
                      ? (lang === 'hi' ? 'रोकें' : 'Stop')
                      : (lang === 'hi' ? 'सुनें' : 'Listen')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Composer — pick any invoice, or one-tap the bundled sample */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: WA.chatBg }}>
        <View style={styles.composer}>
          <TouchableOpacity
            style={[styles.sampleBtn, busy && styles.btnDisabled]}
            onPress={handleSample}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={styles.sampleBtnText}>{lang === 'hi' ? 'Sample' : 'Sample'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn, busy && styles.btnDisabled]}
            onPress={handlePick}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Paperclip size={18} color="#fff" />
            )}
            <Text style={styles.sendBtnText}>
              {busy
                ? (lang === 'hi' ? 'जाँच हो रही है…' : 'Checking…')
                : (lang === 'hi' ? 'invoice भेजें' : 'Send an invoice')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WA.chatBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: WA.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  disclosure: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8E1', paddingHorizontal: spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0E2B6',
  },
  disclosureText: { flex: 1, color: '#7A6A1F', fontSize: 12 },
  chat: { flex: 1 },
  chatContent: { padding: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '82%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: WA.botBubble },
  userBubble: { alignSelf: 'flex-end', backgroundColor: WA.userBubble },
  bubbleText: { color: WA.ink, fontSize: 14, lineHeight: 20 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: WA.inkMuted, fontSize: 13, fontStyle: 'italic' },
  invoiceThumb: { width: 180, height: 130, borderRadius: 8, backgroundColor: '#fff' },
  caption: { color: WA.inkMuted, fontSize: 11, marginTop: 4 },
  speakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EAEFEA' },
  speakText: { color: WA.header, fontSize: 13, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  sampleBtn: {
    paddingHorizontal: spacing.md, height: 50, borderRadius: radii.button,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: WA.header,
  },
  sampleBtnText: { color: WA.header, fontWeight: '700', fontSize: 14 },
  sendBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: WA.header, borderRadius: radii.button, height: 50,
  },
  btnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
