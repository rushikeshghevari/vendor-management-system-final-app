import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Notification, NotificationType } from '@/features/notifications/types';

interface NotificationListItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

const TYPE_ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  quotation_submitted: 'document-text-outline',
  quotation_reviewed: 'checkmark-circle-outline',
  review_pending: 'hourglass-outline',
  quotation_negotiation: 'swap-horizontal-outline',
  quotation_rejected: 'close-circle-outline',
  quotation_resubmitted: 'refresh-outline',
  quotation_approved: 'checkmark-done-outline',
  bill_submitted: 'receipt-outline',
  bill_verified: 'shield-checkmark-outline',
  payment_pending: 'time-outline',
  payment_paid: 'cash-outline',
  payment_completed: 'checkmark-done-circle-outline',
};

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationListItem({ notification, onPress }: NotificationListItemProps) {
  return (
    <Pressable
      onPress={() => onPress(notification)}
      className={`flex-row gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 ${notification.isRead ? '' : 'bg-primary-50/40 dark:bg-primary-900/10'}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
        <Ionicons name={TYPE_ICON[notification.notificationType]} size={18} color="#1e88e5" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-sm font-semibold text-ink dark:text-white">{notification.title}</Text>
          {notification.isRead ? null : <View className="mt-1 h-2 w-2 rounded-full bg-primary-500" />}
        </View>
        <Text className="mt-0.5 text-sm text-ink-muted dark:text-slate-400" numberOfLines={2}>
          {notification.message}
        </Text>
        <Text className="mt-1 text-xs text-ink-muted dark:text-slate-500">{formatTimeAgo(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}
