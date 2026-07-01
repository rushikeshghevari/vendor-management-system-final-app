import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BrandLogo } from '@/components/branding/BrandLogo';

interface AppHeaderProps {
  /** `solid` is the primary-blue bar used by Profile/ComingSoon. `brand` is the light, logo-centered bar used by the Dashboard. */
  variant?: 'solid' | 'brand';
  title?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  leftAccessibilityLabel?: string;
  rightSlot?: ReactNode;
}

/** Top bar used across the authenticated app (Dashboard, Profile, etc.). */
export function AppHeader({
  variant = 'solid',
  title,
  leftIcon,
  onLeftPress,
  leftAccessibilityLabel,
  rightSlot,
}: AppHeaderProps) {
  if (variant === 'brand') {
    return (
      <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-surface-dark">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={leftAccessibilityLabel ?? 'Open menu'}
          onPress={onLeftPress}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center"
        >
          <Ionicons name={leftIcon ?? 'menu-outline'} size={26} color="#212121" />
        </Pressable>

        <BrandLogo size="sm" />

        <View className="flex-row items-center gap-3" style={{ minWidth: 40 }}>
          {rightSlot}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between bg-primary-600 px-4 py-4">
      <View className="w-10">
        {leftIcon ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={leftAccessibilityLabel ?? title}
            onPress={onLeftPress}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center"
          >
            <Ionicons name={leftIcon} size={24} color="#ffffff" />
          </Pressable>
        ) : null}
      </View>

      <Text className="flex-1 text-center text-lg font-bold text-white" numberOfLines={1}>
        {title}
      </Text>

      <View className="flex-row items-center justify-end gap-3" style={{ minWidth: 40 }}>
        {rightSlot}
      </View>
    </View>
  );
}
