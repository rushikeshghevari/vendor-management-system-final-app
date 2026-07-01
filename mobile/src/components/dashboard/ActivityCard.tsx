import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface ActivityCardProps {
  icon: ReactNode;
  iconBackground: string;
  title: string;
  subtitle: string;
  time: string;
  /** Render a divider below this row — omit on the last item in a list. */
  showDivider?: boolean;
}

export function ActivityCard({ icon, iconBackground, title, subtitle, time, showDivider = true }: ActivityCardProps) {
  return (
    <View
      className={`flex-row items-start gap-3 py-3 ${showDivider ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: iconBackground }}>
        {icon}
      </View>

      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-sm font-semibold text-ink dark:text-white">{title}</Text>
          <Text className="text-xs text-ink-muted dark:text-slate-500">{time}</Text>
        </View>
        <Text className="mt-0.5 text-xs text-ink-muted dark:text-slate-400">{subtitle}</Text>
      </View>
    </View>
  );
}
