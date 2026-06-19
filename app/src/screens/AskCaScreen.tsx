import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Sparkles, MessageCircleQuestion } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { colors, typography, spacing, radii, elevation, gradients } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { askGstDoubt } from '../api/ai';

interface Msg {
  id: string;
  role: 'user' | 'ca';
  text: string;
  offline?: boolean;
}

export default function AskCaScreen() {
  const { t, lang } = useI18n();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (questionText?: string) => {
    const question = (questionText ?? input).trim();
    if (!question || busy) return;

    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text: question };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { answer, method } = await askGstDoubt(question, lang);
      setMessages((m) => [
        ...m,
        { id: `c-${Date.now()}`, role: 'ca', text: answer, offline: method === 'fallback' },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `c-${Date.now()}`,
          role: 'ca',
          text: lang === 'hi'
            ? 'अभी जवाब नहीं मिल पाया। Server चालू है या नहीं जांचें।'
            : "Couldn't reach the assistant. Check that the AI server is running.",
          offline: true,
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const showGreeting = messages.length === 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <MessageCircleQuestion size={22} color={colors.surface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t.askCa.title}</Text>
              <Text style={styles.headerSub}>{t.askCa.subtitle}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.chat}
          showsVerticalScrollIndicator={false}
        >
          {showGreeting && (
            <>
              <View style={styles.greetingCard}>
                <Sparkles size={18} color={colors.primary} />
                <Text style={styles.greetingText}>{t.askCa.greeting}</Text>
              </View>
              <Text style={styles.faqTitle}>{t.askCa.faqTitle}</Text>
              <Text style={styles.faqHint}>{t.askCa.faqHint}</Text>
              <View style={styles.suggestions}>
                {[t.askCa.suggestion1, t.askCa.suggestion2, t.askCa.suggestion3, t.askCa.suggestion4].map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => send(s)} activeOpacity={0.8}>
                    <MessageCircleQuestion size={16} color={colors.primary} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <View key={m.id} style={styles.userBubble}>
                <Text style={styles.userText}>{m.text}</Text>
              </View>
            ) : (
              <View key={m.id} style={styles.caBubble}>
                <Text style={styles.caText}>{m.text}</Text>
                {m.offline && <Text style={styles.offlineNote}>{t.askCa.offlineNote}</Text>}
              </View>
            ),
          )}

          {busy && (
            <View style={styles.caBubble}>
              <View style={styles.thinkingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.thinkingText}>{t.askCa.thinking}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t.askCa.placeholder}
            placeholderTextColor={colors.inkMuted}
            multiline
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || busy) && styles.sendButtonDisabled]}
            onPress={() => send()}
            disabled={!input.trim() || busy}
            activeOpacity={0.85}
          >
            <Send size={20} color={colors.surface} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...elevation.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  headerIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.surface },
  headerSub: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  chat: { padding: spacing.screenH, gap: spacing.md, paddingBottom: spacing.lg },
  greetingCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.recognitionBg,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(4,94,254,0.15)',
  },
  greetingText: { ...typography.body, color: colors.inkSecondary, flex: 1 },
  faqTitle: { ...typography.heading2, color: colors.ink, marginTop: spacing.lg },
  faqHint: { ...typography.caption, color: colors.inkMuted, marginBottom: spacing.sm },
  suggestions: { gap: spacing.sm },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.soft,
  },
  suggestionText: { ...typography.body, color: colors.primary, fontWeight: '600', flex: 1 },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...elevation.soft,
  },
  userText: { ...typography.body, color: colors.surface },
  caBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderBottomLeftRadius: 4,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.soft,
  },
  caText: { ...typography.body, color: colors.ink },
  offlineNote: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thinkingText: { ...typography.body, color: colors.inkMuted },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.screenH,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.ink,
    backgroundColor: colors.background,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...elevation.primary,
  },
  sendButtonDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
});
