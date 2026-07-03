import { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { NotificationCard } from '@/features/notifications/components/NotificationCard';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useArchiveNotificationMutation,
  useDeleteNotificationMutation,
  useDeleteAllNotificationsMutation,
} from '@/features/notifications/api/notificationsApi';
import type { Notification, NotificationModule } from '@/features/notifications/types';
import type { NotificationsStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { ROLES } from '@/constants/roles';

type Props = NativeStackScreenProps<NotificationsStackParamList, 'NotificationList'>;

type FilterTab = 'all' | 'unread' | 'archived';

const MODULE_FILTERS: Array<{ label: string; value: NotificationModule | '' }> = [
  { label: 'All',       value: '' },
  { label: 'Quotation', value: 'quotation' },
  { label: 'Bill',      value: 'bill' },
  { label: 'PO',        value: 'purchase_order' },
  { label: 'Payment',   value: 'payment' },
  { label: 'System',    value: 'system' },
];

export function NotificationsScreen({ navigation }: Props) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(ROLES.SUPER_ADMIN);

  const [activeTab, setActiveTab]       = useState<FilterTab>('all');
  const [moduleFilter, setModuleFilter] = useState<NotificationModule | ''>('');
  const [search, setSearch]             = useState('');

  const queryParams = {
    limit:      100,
    module:     moduleFilter || undefined,
    isRead:     activeTab === 'unread' ? false : undefined,
    isArchived: activeTab === 'archived' ? true : undefined,
  };

  const { data: notifications = [], isLoading, isFetching, refetch } =
    useGetNotificationsQuery(queryParams);

  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();
  const [archiveNotification]  = useArchiveNotificationMutation();
  const [deleteNotification]   = useDeleteNotificationMutation();
  const [deleteAll]            = useDeleteAllNotificationsMutation();

  const filtered = search.trim()
    ? notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.message.toLowerCase().includes(search.toLowerCase()),
      )
    : notifications;

  const handlePress = useCallback((n: Notification) => {
    navigation.navigate('NotificationDetails', { notificationId: n.id });
  }, [navigation]);

  const handleArchive = useCallback((id: string) => {
    archiveNotification(id).catch(() => null);
  }, [archiveNotification]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Notification', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(id).catch(() => null) },
    ]);
  }, [deleteNotification]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert('Delete All Notifications', 'This will remove all your notifications. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: () => deleteAll().catch(() => null) },
    ]);
  }, [deleteAll]);

  const unreadCount = notifications.filter((n) => !n.isRead && !n.isArchived).length;

  return (
    <Screen padded={false}>
      <AppHeader
        title={unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications'}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightSlot={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => markAllRead()}
              disabled={isMarkingAll}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>Mark all read</Text>
            </TouchableOpacity>
            {isSuperAdmin && (
              <TouchableOpacity
                onPress={() => navigation.navigate('NotificationSettings')}
                style={styles.headerBtn}
              >
                <Ionicons name="settings-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notifications..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab filter */}
      <View style={styles.tabRow}>
        {(['all', 'unread', 'archived'] as FilterTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.tab, styles.tabDelete]} onPress={handleDeleteAll}>
          <Ionicons name="trash-outline" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Module filter chips */}
      <FlatList
        horizontal
        data={MODULE_FILTERS}
        keyExtractor={(f) => f.value || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setModuleFilter(item.value as NotificationModule | '')}
            style={[styles.chip, moduleFilter === item.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, moduleFilter === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={handlePress}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'unread'
                  ? "You're all caught up!"
                  : activeTab === 'archived'
                  ? 'No archived notifications'
                  : 'No notifications yet'}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn:       { paddingHorizontal: 4, paddingVertical: 2 },
  headerBtnText:   { fontSize: 12, fontWeight: '600', color: '#fff' },
  searchRow:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBox:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput:     { flex: 1, fontSize: 14, color: '#111827' },
  tabRow:          { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab:             { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  tabActive:       { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  tabDelete:       { marginLeft: 'auto', backgroundColor: '#F9FAFB' },
  tabText:         { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  tabTextActive:   { color: '#2563EB', fontWeight: '600' },
  filterRow:       { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  chip:            { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive:      { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText:        { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  chipTextActive:  { color: '#2563EB', fontWeight: '600' },
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:           { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle:      { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 8 },
  emptySubtitle:   { fontSize: 13, color: '#9CA3AF' },
});
