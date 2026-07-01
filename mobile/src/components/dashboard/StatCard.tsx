import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type StatCardFooter = { type: 'status'; label: string } | { type: 'link'; label: string; onPress?: () => void };

interface StatCardProps {
  icon: ReactNode;
  iconBackground: string;
  value: number | string;
  label: string;
  footer: StatCardFooter;
}

/** KPI tile: icon + big number, a label, and a status dot or "View all" link footer. */
export function StatCard({ icon, iconBackground, value, label, footer }: StatCardProps) {
  return (
    <View className="w-[31%] rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <View className="flex-row items-center gap-2">
        <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: iconBackground }}>
          {icon}
        </View>
        <Text className="text-2xl font-bold text-ink dark:text-white">{value}</Text>
      </View>

      <Text className="mt-2 text-sm font-semibold text-ink dark:text-white">{label}</Text>

      {footer.type === 'status' ? (
        <View className="mt-2 flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-success-500" />
          <Text className="text-xs font-medium text-success-500">{footer.label}</Text>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={footer.label} onPress={footer.onPress} hitSlop={8} className="mt-2 self-start">
          <Text className="text-xs font-semibold text-primary-600">{footer.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
