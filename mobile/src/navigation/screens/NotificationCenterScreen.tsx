import { FlatList, Pressable, RefreshControl, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { NotificationListItem } from '@/components/notifications/NotificationListItem';
import { AppHeader } from '@/components/layout/AppHeader';
import { Loader } from '@/components/ui/Loader';
import { Screen } from '@/components/ui/Screen';
import { ROLES } from '@/constants/roles';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/features/notifications/api/notificationsApi';
import type { Notification } from '@/features/notifications/types';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationCenter'>;

export function NotificationCenterScreen({ navigation }: Props) {
  const { hasRole } = useAuth();
  const isDepartmentUser = hasRole(ROLES.DEPARTMENT_USER);
  const isDirector = hasRole(ROLES.DIRECTOR);
  const isAccounts = hasRole(ROLES.ACCOUNTS);

  const { data: notifications, isLoading, isFetching, refetch } = useGetNotificationsQuery();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: isMarkingAllRead }] = useMarkAllNotificationsReadMutation();

  // This screen now lives at the root (a sibling of "Main", not nested inside any tab's own
  // stack — see RootNavigator.tsx), so reaching a tab's nested screen means forwarding
  // through "Main" itself rather than `getParent()` (there is no longer a Tab Navigator
  // directly above this screen).
  const navigateIntoMain = (tab: string, params: object) => {
    (navigation as unknown as { navigate: (name: string, params?: object) => void }).navigate('Main', {
      screen: tab,
      params,
    });
  };

  // Only roles that already have a screen for the related record can deep-link into it
  // (Super Admin / Payment Department don't have a Quotation/Bill detail screen in their
  // tab tree yet) — for everyone else, tapping still marks the notification read.
  const handlePress = (notification: Notification) => {
    if (!notification.isRead) markRead(notification.id);

    if (notification.module === 'quotation' && (isDepartmentUser || isDirector)) {
      const tab = isDirector ? 'PendingQuotations' : 'Quotations';
      navigateIntoMain(tab, { screen: 'QuotationDetails', params: { quotationId: notification.relatedRecordId } });
    } else if (notification.module === 'bill' && isAccounts) {
      navigateIntoMain('Bills', { screen: 'AccountsBillDetails', params: { billId: notification.relatedRecordId } });
    } else if (notification.module === 'bill' && isDepartmentUser) {
      navigateIntoMain('Bills', { screen: 'BillDetails', params: { billId: notification.relatedRecordId } });
    }
  };

  return (
    <Screen padded={false}>
      <AppHeader
        title="Notifications"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightSlot={
          <Pressable accessibilityRole="button" onPress={() => markAllRead()} disabled={isMarkingAllRead}>
            <Text className="text-sm font-semibold text-white">Mark all read</Text>
          </Pressable>
        }
      />

      {isLoading ? (
        <Loader fullscreen />
      ) : (
        <FlatList
          data={notifications ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationListItem notification={item} onPress={handlePress} />}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
          ListEmptyComponent={
            <Text className="mt-12 text-center text-sm text-ink-muted dark:text-slate-400">No notifications yet.</Text>
          }
        />
      )}
    </Screen>
  );
}
