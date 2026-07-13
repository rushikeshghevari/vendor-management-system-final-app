import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, type TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteUserSheet } from '@/components/users/DeleteUserSheet';
import { UserBulkActionBar } from '@/components/users/UserBulkActionBar';
import { UserCard } from '@/components/users/UserCard';
import { UserEmptyState } from '@/components/users/UserEmptyState';
import { UserSearch } from '@/components/users/UserSearch';
import { UserSkeleton } from '@/components/users/UserSkeleton';
import { FilterChipRow } from '@/components/users/FilterChipRow';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Fab } from '@/components/ui/Fab';
import { NotificationBadge } from '@/components/ui/NotificationBadge';
import { Pagination } from '@/components/ui/Pagination';
import { Screen } from '@/components/ui/Screen';
import { useBulkSetHodUserStatusMutation, useDeleteHodUserMutation, useGetHodUsersQuery } from '@/features/hod/api/hodApi';
import { buildUsersCsv } from '@/features/users/csv';
import type { AppUser } from '@/features/users/types';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { shareCsv } from '@/utils/csvExport';
import type { HodUsersStackParamList } from '@/navigation/types';

const PAGE_SIZE = 5;
const SKELETON_PLACEHOLDERS = [1, 2, 3, 4];

const STATUS_OPTIONS: Array<{ value: 'all' | 'active' | 'inactive'; label: string }> = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

type Props = NativeStackScreenProps<HodUsersStackParamList, 'UserList'>;

export function HodUserListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const searchInputRef = useRef<TextInput>(null);

  const { data: users, isLoading } = useGetHodUsersQuery();
  const [deleteUser] = useDeleteHodUserMutation();
  const [bulkSetStatus] = useBulkSetHodUserStatusMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (users ?? []).filter((item: AppUser) => {
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? item.isActive : !item.isActive);
      const matchesQuery =
        !query || item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [users, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleAddUser = () => navigation.navigate('CreateUser');

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const handleCardPress = (target: AppUser) => {
    if (selectionMode) {
      toggleSelected(target.id);
      return;
    }
    navigation.navigate('UserDetails', { userId: target.id });
  };

  const handleLongPress = useCallback((target: AppUser) => {
    setSelectionMode(true);
    toggleSelected(target.id);
  }, [toggleSelected]);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkSetStatus = useCallback(async (isActive: boolean) => {
    try {
      await bulkSetStatus({ ids: Array.from(selectedIds), isActive }).unwrap();
    } catch (error) {
      Alert.alert('Could Not Update Users', getErrorMessage(error));
    } finally {
      handleCancelSelection();
    }
  }, [selectedIds, bulkSetStatus, handleCancelSelection]);

  const handleDeletePress = (target: AppUser) => setUserToDelete(target);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    const target = userToDelete;
    setUserToDelete(null);
    try {
      await deleteUser(target.id).unwrap();
    } catch (error) {
      Alert.alert('Could Not Deactivate User', getErrorMessage(error));
    }
  };

  const handleExportCsv = async () => {
    try {
      await shareCsv(`department-users-${Date.now()}.csv`, buildUsersCsv(filteredUsers));
    } catch (error) {
      Alert.alert('Could Not Export Users', getErrorMessage(error));
    }
  };

  return (
    <Screen padded={false}>
      <AppHeader
        title="Department Users"
        leftIcon="menu-outline"
        rightSlot={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search"
              hitSlop={8}
              onPress={() => searchInputRef.current?.focus()}
            >
              <Ionicons name="search-outline" size={22} color="#ffffff" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Export users to CSV" hitSlop={8} onPress={handleExportCsv}>
              <Ionicons name="download-outline" size={22} color="#ffffff" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Notifications" className="relative" hitSlop={8}>
              <Ionicons name="notifications-outline" size={22} color="#ffffff" />
              <NotificationBadge count={5} />
            </Pressable>
            <Avatar initials={initials} size={32} online />
          </>
        }
      />

      <View className="flex-1 bg-surface-muted px-4 pt-4 dark:bg-surface-dark">
        <UserSearch value={searchQuery} onChangeText={handleSearchChange} />

        <View className="mt-3">
          <Text className="mb-1.5 text-xs font-semibold text-ink-muted dark:text-slate-400">Status</Text>
          <FilterChipRow
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          />
        </View>

        {selectionMode ? (
          <View className="-mx-4 mt-3">
            <UserBulkActionBar
              count={selectedIds.size}
              onActivate={() => handleBulkSetStatus(true)}
              onDeactivate={() => handleBulkSetStatus(false)}
              onCancel={handleCancelSelection}
            />
          </View>
        ) : null}

        {isLoading ? (
          <View className="mt-4">
            {SKELETON_PLACEHOLDERS.map((key) => (
              <UserSkeleton key={key} />
            ))}
          </View>
        ) : pagedUsers.length === 0 ? (
          <UserEmptyState onAddPress={handleAddUser} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
            <View className="mt-4">
              {pagedUsers.map((item) => (
                <UserCard
                  key={item.id}
                  user={item}
                  onPress={handleCardPress}
                  onDelete={handleDeletePress}
                  onLongPress={handleLongPress}
                  selected={selectedIds.has(item.id)}
                  selectionMode={selectionMode}
                />
              ))}
            </View>
            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </ScrollView>
        )}
      </View>

      <View className="absolute bottom-6 right-6">
        <Fab accessibilityLabel="Add User" onPress={handleAddUser} />
      </View>

      <DeleteUserSheet
        visible={userToDelete !== null}
        userName={userToDelete?.name ?? ''}
        onCancel={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </Screen>
  );
}
