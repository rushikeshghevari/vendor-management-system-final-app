import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SectionHeader } from '@/components/ui/SectionHeader';

export interface MyTask {
  label: string;
  count: number | string;
  onPress?: () => void;
}

interface MyTasksListProps {
  tasks: MyTask[];
}

/** Role-agnostic "what's pending for me" widget — every Dashboard composes it from data it
 *  already fetches (stats endpoints or already-loaded lists), never a new backend call. */
export function MyTasksList({ tasks }: MyTasksListProps) {
  return (
    <DashboardCard className="mt-4">
      <SectionHeader title="My Tasks" />
      <View className="mt-2">
        {tasks.map((task, index) => {
          const Row = task.onPress ? Pressable : View;
          return (
            <Row
              key={task.label}
              onPress={task.onPress}
              className={`flex-row items-center justify-between py-2.5 ${index === 0 ? '' : 'border-t border-slate-100 dark:border-slate-800'}`}
            >
              <Text className="flex-1 text-sm text-ink dark:text-slate-200">{task.label}</Text>
              <View className="flex-row items-center gap-1.5">
                <View className="min-w-[28px] items-center rounded-full bg-primary-50 px-2 py-0.5 dark:bg-primary-900/30">
                  <Text className="text-xs font-bold text-primary-600 dark:text-primary-400">{task.count}</Text>
                </View>
                {task.onPress ? <Ionicons name="chevron-forward" size={14} color="#94a3b8" /> : null}
              </View>
            </Row>
          );
        })}
      </View>
    </DashboardCard>
  );
}
