import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ROLE_LABELS } from '@/constants/roleLabels';
import type { AppUser } from '@/features/users/types';

interface UserCardProps {
  user: AppUser;
  onPress?: (user: AppUser) => void;
  onDelete?: (user: AppUser) => void;
}

export function UserCard({ user, onPress, onDelete }: UserCardProps) {
  const initials = user.name.charAt(0).toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={user.name}
      onPress={() => onPress?.(user)}
      android_ripple={{ color: '#e2e8f0' }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      className="mb-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-start gap-3 pr-2">
          <Avatar initials={initials} size={44} />
          <View className="flex-1">
            <Text className="text-base font-bold text-ink dark:text-white">{user.name}</Text>
            <Text className="mt-0.5 text-xs text-ink-muted dark:text-slate-400" numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>
        <Badge label={user.isActive ? 'Active' : 'Inactive'} variant={user.isActive ? 'success' : 'neutral'} />
      </View>

      <View className="mt-3 flex-row items-center gap-1.5">
        <Ionicons name="shield-outline" size={13} color="#5f5f5f" />
        <Text className="text-xs text-ink-muted dark:text-slate-500">{ROLE_LABELS[user.role]}</Text>
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="business-outline" size={13} color="#5f5f5f" />
          <Text className="text-xs text-ink-muted dark:text-slate-500">{user.departmentName}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${user.name}`}
          onPress={() => onDelete?.(user)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color="#e53935" />
        </Pressable>
      </View>
    </Pressable>
  );
}
