import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

interface QuickActionCardProps {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
}

/** Bordered white tile used in the Quick Actions grid: icon on top, label below. */
export function QuickActionCard({ icon, label, onPress }: QuickActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: '#e2e8f0' }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
      className="w-[31%] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 dark:border-slate-700 dark:bg-slate-900"
    >
      {icon}
      <Text className="text-center text-xs font-semibold text-ink dark:text-white">{label}</Text>
    </Pressable>
  );
}
