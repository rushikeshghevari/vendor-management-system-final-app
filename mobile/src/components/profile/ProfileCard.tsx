import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui/Badge';

interface ProfileCardProps {
  name: string;
  email: string;
  roleLabel: string;
  /** URI of the user's chosen profile photo; falls back to initials avatar when absent. */
  photoUri?: string | null;
}

export function ProfileCard({ name, email, roleLabel, photoUri }: ProfileCardProps) {
  const initials = name.charAt(0).toUpperCase() || 'U';

  return (
    <View className="items-center py-6">
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          className="h-20 w-20 rounded-full"
          accessibilityLabel="Profile photo"
        />
      ) : (
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
          <Text className="text-3xl font-bold text-primary-600 dark:text-primary-400">{initials}</Text>
        </View>
      )}

      <Text className="mt-3 text-lg font-bold text-ink dark:text-white">{name}</Text>
      <Text className="text-sm text-ink-muted dark:text-slate-400">{email}</Text>

      <View className="mt-2">
        <Badge label={roleLabel} variant="primary" />
      </View>
    </View>
  );
}
