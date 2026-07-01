import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Department } from '@/features/departments/types';

interface DepartmentSelectCardProps {
  department: Department;
  onPress: (department: Department) => void;
}

/** Tappable row used on the Department Selection screen, in the Add User flow. */
export function DepartmentSelectCard({ department, onPress }: DepartmentSelectCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${department.name}`}
      onPress={() => onPress(department)}
      android_ripple={{ color: '#e2e8f0' }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      className="mb-3 flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
        <Ionicons name="business" size={20} color="#1e88e5" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-ink dark:text-white">{department.name}</Text>
        <Text className="mt-0.5 text-xs text-ink-muted dark:text-slate-400">{department.code}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}
