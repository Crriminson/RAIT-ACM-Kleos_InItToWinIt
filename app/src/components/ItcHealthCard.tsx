import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from './AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';

interface Props {
  totalBlocked: number;
  totalMatched: number;
  issueCount: number;
  resolvedCount: number;
}

function formatRupee(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

const SIZE = 116;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function ItcHealthCard({ totalBlocked, totalMatched, issueCount, resolvedCount }: Props) {
  const { lang } = useI18n();

  const denom = totalBlocked + totalMatched;
  const score = denom === 0 ? 100 : Math.round((totalMatched / denom) * 100);
  const ringColor =
    score >= 70 ? colors.severity.resolved : score >= 40 ? colors.severity.pending : colors.severity.blocked;

  const matchedPct = denom === 0 ? 100 : (totalMatched / denom) * 100;
  const dashOffset = CIRC * (1 - score / 100);

  const label =
    score >= 70 ? (lang === 'hi' ? 'अच्छा' : 'Healthy')
    : score >= 40 ? (lang === 'hi' ? 'ध्यान दें' : 'Needs care')
    : (lang === 'hi' ? 'जोखिम' : 'At risk');

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {/* Gauge */}
        <View style={styles.gauge}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={ringColor}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          <View style={styles.gaugeCenter}>
            <Text style={[styles.score, { color: ringColor }]}>{score}%</Text>
            <Text style={styles.scoreLabel}>{label}</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>
            {lang === 'hi' ? 'ITC सेहत' : 'ITC Health'}
          </Text>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: colors.severity.resolved }]} />
            <Text style={styles.legendText}>
              {formatRupee(totalMatched)} {lang === 'hi' ? 'सुरक्षित' : 'safe'} · {resolvedCount}
            </Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: colors.severity.blocked }]} />
            <Text style={styles.legendText}>
              {formatRupee(totalBlocked)} {lang === 'hi' ? 'अटकी' : 'blocked'} · {issueCount}
            </Text>
          </View>
        </View>
      </View>

      {/* Stacked bar */}
      <View style={styles.bar}>
        <View style={[styles.barSeg, { backgroundColor: colors.severity.resolved, flex: Math.max(matchedPct, 0.01) }]} />
        <View style={[styles.barSeg, { backgroundColor: colors.severity.blocked, flex: Math.max(100 - matchedPct, 0.01) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gauge: { width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' },
  gaugeCenter: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  score: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  scoreLabel: { ...typography.caption, color: colors.inkMuted, fontWeight: '600' },
  legend: { flex: 1, gap: spacing.xs },
  legendTitle: { ...typography.heading2, color: colors.ink, marginBottom: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.body, color: colors.inkSecondary, fontSize: 14 },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barSeg: { height: '100%' },
});
