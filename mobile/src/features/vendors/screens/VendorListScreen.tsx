import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, type TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FilterChipRow } from '@/components/users/FilterChipRow';
import { VendorCard } from '@/components/vendors/VendorCard';
import { VendorEmptyState } from '@/components/vendors/VendorEmptyState';
import { VendorSearch } from '@/components/vendors/VendorSearch';
import { VendorSkeleton } from '@/components/vendors/VendorSkeleton';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Fab } from '@/components/ui/Fab';
import { NotificationBadge } from '@/components/ui/NotificationBadge';
import { Pagination } from '@/components/ui/Pagination';
import { Screen } from '@/components/ui/Screen';
import { useGetVendorsQuery } from '@/features/vendors/api/vendorsApi';
import type { Vendor, VendorStatus } from '@/features/vendors/types';
import { useAuth } from '@/hooks/useAuth';
import type { VendorsStackParamList } from '@/navigation/types';

const PAGE_SIZE = 5;
const SKELETON_PLACEHOLDERS = [1, 2, 3, 4];

const STATUS_OPTIONS: Array<{ value: VendorStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blacklisted', label: 'Blacklisted' },
];

type Props = NativeStackScreenProps<VendorsStackParamList, 'VendorList'>;

export function VendorListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const searchInputRef = useRef<TextInput>(null);

  const { data: vendors, isLoading, isFetching, refetch } = useGetVendorsQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set((vendors ?? []).map((item) => item.category)));
    return [{ value: 'all', label: 'All Categories' }, ...categories.map((item) => ({ value: item, label: item }))];
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (vendors ?? []).filter((item: Vendor) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        (item.gstNumber ?? '').toLowerCase().includes(query) ||
        item.phone.toLowerCase().includes(query);
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [vendors, searchQuery, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedVendors = filteredVendors.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleAddVendor = () => navigation.navigate('AddVendor');
  const handleCardPress = (vendor: Vendor) => navigation.navigate('VendorDetails', { vendorId: vendor.id });

  return (
    <Screen padded={false}>
      <AppHeader
        title="Vendors"
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
            <Pressable accessibilityRole="button" accessibilityLabel="Notifications" className="relative" hitSlop={8}>
              <Ionicons name="notifications-outline" size={22} color="#ffffff" />
              <NotificationBadge count={5} />
            </Pressable>
            <Avatar initials={initials} size={32} online />
          </>
        }
      />

      <View className="flex-1 bg-surface-muted px-4 pt-4 dark:bg-surface-dark">
        <VendorSearch ref={searchInputRef} value={searchQuery} onChangeText={handleSearchChange} />

        <View className="mt-3">
          <Text className="mb-1.5 text-xs font-semibold text-ink-muted dark:text-slate-400">Category</Text>
          <FilterChipRow
            value={categoryFilter}
            options={categoryOptions}
            onChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
          />
        </View>

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

        {isLoading ? (
          <View className="mt-4">
            {SKELETON_PLACEHOLDERS.map((key) => (
              <VendorSkeleton key={key} />
            ))}
          </View>
        ) : (
          <FlatList
            data={pagedVendors}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <VendorCard vendor={item} onPress={handleCardPress} />}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
            ListEmptyComponent={<VendorEmptyState onAddPress={handleAddVendor} />}
            ListFooterComponent={
              pagedVendors.length > 0 ? (
                <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
              ) : null
            }
          />
        )}
      </View>

      <View className="absolute bottom-6 right-6">
        <Fab accessibilityLabel="Add Vendor" onPress={handleAddVendor} />
      </View>
    </Screen>
  );
}
