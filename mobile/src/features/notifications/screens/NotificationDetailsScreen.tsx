import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { Loader } from '@/components/ui/Loader';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
} from '@/features/notifications/api/notificationsApi';
import type { NotificationCategory, NotificationType } from '@/features/notifications/types';
import type { NotificationsStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { ROLES } from '@/constants/roles';

type Props = NativeStackScreenProps<NotificationsStackParamList, 'NotificationDetails'>;

const CATEGORY_COLOR: Record<NotificationCategory, string> = {
  information: '#2563EB',
  success:     '#16A34A',
  warning:     '#D97706',
  error:       '#DC2626',
};

const CATEGORY_BG: Record<NotificationCategory, string> = {
  information: '#EFF6FF',
  success:     '#F0FDF4',
  warning:     '#FFFBEB',
  error:       '#FEF2F2',
};

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

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getDeepLinkTarget(
  module: string,
  relatedRecordId: string,
  role: string,
): { tab: string; screen: string; params: Record<string, unknown> } | null {
  if (module === 'quotation') {
    if (role === 'director') return { tab: 'PendingQuotations', screen: 'QuotationDetails', params: { quotationId: relatedRecordId } };
    if (role === 'ceo')      return { tab: 'PendingQuotations', screen: 'QuotationDetails', params: { quotationId: relatedRecordId } };
    return { tab: 'Quotations', screen: 'QuotationDetails', params: { quotationId: relatedRecordId } };
  }
  if (module === 'bill') {
    if (role === 'accounts') return { tab: 'Bills', screen: 'AccountsBillDetails', params: { billId: relatedRecordId } };
    if (role === 'director') return { tab: 'PendingBillApprovals', screen: 'BillDetails', params: { billId: relatedRecordId } };
    if (role === 'ceo')      return { tab: 'PendingBillApprovals', screen: 'BillDetails', params: { billId: relatedRecordId } };
    return { tab: 'Bills', screen: 'BillDetails', params: { billId: relatedRecordId } };
  }
  if (module === 'purchase_order') {
    return { tab: 'PurchaseOrders', screen: 'PurchaseOrderDetails', params: { purchaseOrderId: relatedRecordId } };
  }
  if (module === 'payment') {
    return { tab: 'Payments', screen: 'PaymentDetails', params: { paymentId: relatedRecordId } };
  }
  return null;
}

export function NotificationDetailsScreen({ route, navigation }: Props) {
  const { notificationId } = route.params;
  const { user } = useAuth();

  const { data: notifications = [], isLoading } = useGetNotificationsQuery(undefined);
  const [markRead] = useMarkNotificationReadMutation();

  const notification = notifications.find((n) => n.id === notificationId);

  if (isLoading) {
    return (
      <Screen padded={false}>
        <AppHeader title="Notification" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Loader fullscreen />
      </Screen>
    );
  }

  if (!notification) {
    return (
      <Screen padded={false}>
        <AppHeader title="Notification" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
          <Text style={styles.notFoundText}>Notification not found</Text>
        </View>
      </Screen>
    );
  }

  const color = CATEGORY_COLOR[notification.category] ?? '#2563EB';
  const bg    = CATEGORY_BG[notification.category] ?? '#EFF6FF';
  const icon  = TYPE_ICON[notification.notificationType] ?? 'notifications-outline';

  const deepLink = user?.role ? getDeepLinkTarget(notification.module, notification.relatedRecordId, user.role) : null;

  const handleNavigate = () => {
    if (!deepLink) return;
    if (!notification.isRead) markRead(notification.id).catch(() => null);
    (navigation as unknown as { navigate: (name: string, params?: object) => void })
      .navigate('Main', {
        screen: deepLink.tab,
        params: { screen: deepLink.screen, params: deepLink.params },
      });
  };

  return (
    <Screen padded={false}>
      <AppHeader title="Notification Details" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Icon header */}
        <View style={[styles.iconHeader, { backgroundColor: bg }]}>
          <View style={[styles.iconCircle, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={36} color={color} />
          </View>
          <Text style={[styles.typeLabel, { color }]}>
            {notification.notificationType.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.card}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.message}>{notification.message}</Text>
        </View>

        {/* Meta */}
        <View style={styles.metaCard}>
          <MetaRow label="Module"   value={notification.module.replace(/_/g, ' ')} />
          <MetaRow label="Priority" value={notification.priority} />
          <MetaRow label="Category" value={notification.category} />
          <MetaRow label="Status"   value={notification.isRead ? 'Read' : 'Unread'} />
          <MetaRow label="Received" value={formatDate(notification.createdAt)} />
          {notification.clickedAt && (
            <MetaRow label="Opened"   value={formatDate(notification.clickedAt)} />
          )}
        </View>

        {/* Deep link action */}
        {deepLink && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }]} onPress={handleNavigate}>
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>View {notification.module.replace(/_/g, ' ')}</Text>
          </TouchableOpacity>
        )}

        {!notification.isRead && (
          <TouchableOpacity
            style={styles.markReadBtn}
            onPress={() => markRead(notification.id).catch(() => null)}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#2563EB" />
            <Text style={styles.markReadText}>Mark as read</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:        { paddingBottom: 40 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText:  { fontSize: 16, color: '#6B7280' },
  iconHeader:    { alignItems: 'center', paddingVertical: 32, gap: 12 },
  iconCircle:    { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  typeLabel:     { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  card:          { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  title:         { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 },
  message:       { fontSize: 14, color: '#374151', lineHeight: 22 },
  metaCard:      { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  metaRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  metaLabel:     { fontSize: 13, color: '#6B7280', textTransform: 'capitalize' },
  metaValue:     { fontSize: 13, color: '#111827', fontWeight: '500', textTransform: 'capitalize' },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, paddingVertical: 14, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  markReadBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  markReadText:  { color: '#2563EB', fontSize: 14, fontWeight: '600' },
});
