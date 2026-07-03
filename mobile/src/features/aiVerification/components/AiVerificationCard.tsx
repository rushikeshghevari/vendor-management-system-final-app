import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { AiVerification } from '@/features/purchaseOrders/types';

interface Props {
  aiVerification: AiVerification;
}

const RISK_COLOR = { LOW: '#059669', MEDIUM: '#D97706', HIGH: '#DC2626' } as const;
const RISK_BG    = { LOW: '#ECFDF5', MEDIUM: '#FFFBEB', HIGH: '#FEF2F2' } as const;
const RISK_ICON: Record<string, 'shield-checkmark' | 'warning' | 'alert-circle'> = {
  LOW:    'shield-checkmark',
  MEDIUM: 'warning',
  HIGH:   'alert-circle',
};

const REC_COLOR = { APPROVE: '#059669', MANUAL_REVIEW: '#D97706', REJECT: '#DC2626' } as const;
const REC_BG    = { APPROVE: '#ECFDF5', MANUAL_REVIEW: '#FFFBEB', REJECT: '#FEF2F2' } as const;
const REC_LABEL = { APPROVE: 'Approve', MANUAL_REVIEW: 'Manual Review', REJECT: 'Reject' } as const;

function ScoreRing({ value }: { value: number }) {
  const color = value >= 85 ? '#059669' : value >= 65 ? '#D97706' : '#DC2626';
  return (
    <View style={[styles.ring, { borderColor: color }]}>
      <Text style={[styles.ringValue, { color }]}>{value}%</Text>
      <Text style={styles.ringLabel}>Match</Text>
    </View>
  );
}

export function AiVerificationCard({ aiVerification: ai }: Props) {
  const risk = ai.risk as keyof typeof RISK_COLOR;
  const rec  = ai.recommendation as keyof typeof REC_COLOR;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={16} color="#7C3AED" />
          <Text style={styles.headerTitle}>AI Verification</Text>
        </View>
        <Text style={styles.headerDate}>
          {new Date(ai.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
      </View>

      {/* Score row */}
      <View style={styles.scoreRow}>
        <ScoreRing value={ai.matchPercentage} />
        <View style={styles.scoreRight}>
          {/* Risk */}
          <View style={[styles.badge, { backgroundColor: RISK_BG[risk] }]}>
            <Ionicons name={RISK_ICON[risk]} size={13} color={RISK_COLOR[risk]} />
            <Text style={[styles.badgeText, { color: RISK_COLOR[risk] }]}>Risk: {risk}</Text>
          </View>
          {/* Recommendation */}
          <View style={[styles.badge, { backgroundColor: REC_BG[rec], marginTop: 6 }]}>
            <Ionicons name="bulb-outline" size={13} color={REC_COLOR[rec]} />
            <Text style={[styles.badgeText, { color: REC_COLOR[rec] }]}>AI: {REC_LABEL[rec]}</Text>
          </View>
          {/* Confidence */}
          <Text style={styles.confidence}>Confidence: {ai.confidence}%</Text>
        </View>
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{ai.ruleEngineScore ?? '—'}%</Text>
          <Text style={styles.metricLabel}>Rule Engine</Text>
        </View>
        <View style={[styles.metric, styles.metricBorder]}>
          <Text style={styles.metricVal}>{ai.differences.length}</Text>
          <Text style={styles.metricLabel}>Differences</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricVal}>{ai.confidence}%</Text>
          <Text style={styles.metricLabel}>Confidence</Text>
        </View>
      </View>

      {/* Summary */}
      {ai.summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>{ai.summary}</Text>
        </View>
      ) : null}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={13} color="#6B7280" />
        <Text style={styles.disclaimerText}>AI assists decision-making. Accounts Department makes the final decision.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:           { backgroundColor: '#FAF5FF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E9D5FF' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle:    { fontSize: 14, fontWeight: '700', color: '#6D28D9' },
  headerDate:     { fontSize: 11, color: '#9CA3AF' },
  scoreRow:       { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  ring:           { width: 80, height: 80, borderRadius: 40, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  ringValue:      { fontSize: 20, fontWeight: '800' },
  ringLabel:      { fontSize: 10, color: '#6B7280', marginTop: 1 },
  scoreRight:     { flex: 1 },
  badge:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, alignSelf: 'flex-start' },
  badgeText:      { fontSize: 12, fontWeight: '600' },
  confidence:     { fontSize: 12, color: '#6B7280', marginTop: 6 },
  metricsRow:     { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  metric:         { flex: 1, alignItems: 'center' },
  metricBorder:   { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#F3F4F6' },
  metricVal:      { fontSize: 16, fontWeight: '700', color: '#111827' },
  metricLabel:    { fontSize: 11, color: '#6B7280', marginTop: 2 },
  summary:        { backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 10 },
  summaryText:    { fontSize: 13, color: '#374151', lineHeight: 19 },
  disclaimer:     { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  disclaimerText: { fontSize: 11, color: '#6B7280', flex: 1, lineHeight: 16 },
});
