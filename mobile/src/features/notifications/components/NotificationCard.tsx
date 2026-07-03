import { Pressable, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Notification, NotificationCategory, NotificationType } from '@/features/notifications/types';

interface Props {
  notification: Notification;
  onPress: (n: Notification) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const TYPE_ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  quotation_submitted:       'document-text-outline',
  quotation_reviewed:        'checkmark-circle-outline',
  review_pending:            'hourglass-outline',
  quotation_negotiation:     'swap-horizontal-outline',
  quotation_rejected:        'close-circle-outline',
  quotation_resubmitted:     'refresh-outline',
  quotation_approved:        'checkmark-done-outline',
  bill_submitted:            'receipt-outline',
  bill_reviewed:             'shield-checkmark-outline',
  bill_review_pending:       'hourglass-outline',
  bill_negotiation:          'swap-horizontal-outline',
  bill_rejected:             'close-circle-outline',
  bill_resubmitted:          'refresh-outline',
  bill_approved:             'checkmark-done-outline',
  bill_verified:             'shield-checkmark-outline',
  payment_pending:           'time-outline',
  payment_created:           'cash-outline',
  payment_processing:        'sync-outline',
  payment_paid:              'cash-outline',
  payment_completed:         'checkmark-done-circle-outline',
  payment_failed:            'alert-circle-outline',
  po_generated:              'clipboard-outline',
  po_bill_uploaded:          'cloud-upload-outline',
  po_ai_verified:            'sparkles-outline',
  po_accounts_verified:      'checkmark-circle-outline',
  po_closed:                 'lock-closed-outline',
  vendor_created:            'business-outline',
  vendor_updated:            'create-outline',
  vendor_inactive:           'pause-circle-outline',
  ai_verification_started:   'sparkles-outline',
  ai_verification_completed: 'sparkles-outline',
  system_announcement:       'megaphone-outline',
  broadcast:                 'radio-outline',
  escalation:                'warning-outline',
  reminder:                  'alarm-outline',
};

const CATEGORY_COLOR: Record<NotificationCategory, string> = {
  information: '#2563EB',
  success:     '#16A34A',
  warning:     '#D97706',
  error:       '#DC2626',
};

const PRIORITY_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  critical: { label: 'Critical', bg: '#FEF2F2', text: '#DC2626' },
  high:     { label: 'High',     bg: '#FFF7ED', text: '#D97706' },
  medium:   { label: 'Medium',   bg: '#EFF6FF', text: '#2563EB' },
  low:      { label: 'Low',      bg: '#F0FDF4', text: '#16A34A' },
};

function formatTimeAgo(isoDate: string): string {
  const diffMs   = Date.now() - new Date(isoDate).getTime();
  const minutes  = Math.floor(diffMs / 60000);
  if (minutes < 1)  return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationCard({ notification: n, onPress, onArchive, onDelete }: Props) {
  const iconColor = CATEGORY_COLOR[n.category] ?? '#2563EB';
  const priorityBadge = PRIORITY_BADGE[n.priority];
  const isUnread = !n.isRead;

  return (
    <Pressable
      onPress={() => onPress(n)}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: isUnread ? '#EFF6FF' : '#FFFFFF',
        }}
      >
        {/* Icon circle */}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: `${iconColor}18`,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ionicons name={TYPE_ICON[n.notificationType] ?? 'notifications-outline'} size={20} color={iconColor} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: isUnread ? '700' : '600',
                color: '#111827',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {n.title}
            </Text>
            {isUnread && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', marginTop: 4 }} />
            )}
          </View>

          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }} numberOfLines={2}>
            {n.message}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{formatTimeAgo(n.createdAt)}</Text>

            {priorityBadge && n.priority !== 'medium' && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: priorityBadge.bg,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: priorityBadge.text }}>
                  {priorityBadge.label}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }} />

            {onArchive && (
              <TouchableOpacity onPress={() => onArchive(n.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="archive-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={() => onDelete(n.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
