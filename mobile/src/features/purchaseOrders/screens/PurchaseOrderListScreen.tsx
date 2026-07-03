import { useState } from 'react';
import {
  FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import { PurchaseOrderCard } from '@/features/purchaseOrders/components/PurchaseOrderCard';
import { useGetPurchaseOrdersQuery } from '@/features/purchaseOrders/api/purchaseOrdersApi';
import { useAuth } from '@/hooks/useAuth';
import type { PurchaseOrderStackParamList } from '@/navigation/types';
import type { PurchaseOrderStatus } from '@/features/purchaseOrders/types';

type Props = NativeStackScreenProps<PurchaseOrderStackParamList, 'PurchaseOrderList'>;

const STATUS_FILTERS: Array<{ label: string; value: PurchaseOrderStatus | '' }> = [
  { label: 'All', value: '' },
  { label: 'Generated', value: 'generated' },
  { label: 'Bill Uploaded', value: 'bill_uploaded' },
  { label: 'AI Verified', value: 'ai_verified' },
  { label: 'Verified', value: 'accounts_verified' },
  { label: 'Closed', value: 'closed' },
];

export function PurchaseOrderListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');

  const { data: pos = [], isLoading, isFetching, refetch } = useGetPurchaseOrdersQuery(
    { status: statusFilter || undefined, search: search || undefined },
  );

  const isDeptUser = user?.role === 'department_user';

  return (
    <Screen padded={false}>
      <AppHeader title="Purchase Orders" />

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search PO number, vendor..."
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

      {/* Status filter chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(f) => f.value || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setStatusFilter(item.value as PurchaseOrderStatus | '')}
            style={[styles.chip, statusFilter === item.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, statusFilter === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      <FlatList
        data={pos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <PurchaseOrderCard
            po={item}
            onPress={() => navigation.navigate('PurchaseOrderDetails', { purchaseOrderId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {isLoading ? 'Loading...' : 'No Purchase Orders found'}
            </Text>
          </View>
        }
      />

      {/* FAB — Department User only */}
      {isDeptUser && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreatePurchaseOrder', undefined)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#F9FAFB' },
  searchRow:     { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput:   { flex: 1, fontSize: 14, color: '#111827' },
  filterRow:     { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive:    { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText:      { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  chipTextActive:{ color: '#2563EB', fontWeight: '600' },
  list:          { paddingHorizontal: 16, paddingBottom: 90 },
  empty:         { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText:     { fontSize: 14, color: '#9CA3AF' },
  fab:           { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
});
