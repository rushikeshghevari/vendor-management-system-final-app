import { StyleSheet, Text, View } from 'react-native';

interface AnalyticsBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

/** Percentage-fill bar row used across dashboard/department analytics sections. */
export function AnalyticsBar({ label, value, max, color }: AnalyticsBarProps) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.count, { color }]}>{value}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { marginBottom: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label:    { fontSize: 12, color: '#475569', fontWeight: '500' },
  count:    { fontSize: 12, fontWeight: '700' },
  barBg:    { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },
});
