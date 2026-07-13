import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TextInput } from 'react-native';

import { FilterChipRow } from '@/components/users/FilterChipRow';
import { PaymentEmptyState } from '@/components/payments/PaymentEmptyState';
import { PaymentListItem } from '@/components/payments/PaymentListItem';
import { PaymentSearch } from '@/components/payments/PaymentSearch';
import { PaymentSkeleton } from '@/components/payments/PaymentSkeleton';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Pagination } from '@/components/ui/Pagination';
import { Screen } from '@/components/ui/Screen';
import { useGetPaymentsQuery } from '@/features/payments/api/paymentsApi';
import { PAYMENT_STATUSES, type Payment, type PaymentStatus } from '@/features/payments/types';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentsStackParamList } from '@/navigation/types';

const PAGE_SIZE = 5;
const SKELETON_PLACEHOLDERS = [1, 2, 3, 4];

const STATUS_TAB_LABEL: Record<PaymentStatus, string> = {
  payment_pending: 'Pending',
  processing: 'Processing',
  paid: 'Paid',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_TABS: { value: PaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...PAYMENT_STATUSES.map((value) => ({ value, label: STATUS_TAB_LABEL[value] })),
];

type Props = NativeStackScreenProps<PaymentsStackParamList, 'PaymentList'>;

export function PaymentListScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const searchInputRef = useRef<TextInput>(null);

  const { data: payments, isLoading, isFetching, refetch } = useGetPaymentsQuery(undefined, { pollingInterval: 15000 });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<PaymentStatus | 'all'>(route.params?.initialStatus ?? 'all');
  const [page, setPage] = useState(1);

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (payments ?? []).filter((item: Payment) => {
      const matchesStatus = statusTab === 'all' || item.status === statusTab;
      const matchesQuery =
        !query || item.paymentCode.toLowerCase().includes(query) || item.invoiceNumber.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [payments, searchQuery, statusTab]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPayments = filteredPayments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleCardPress = (payment: Payment) => navigation.navigate('PaymentDetails', { paymentId: payment.id });

  return (
    <Screen padded={false}>
      <AppHeader
        title="Payments"
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
            <NotificationBell />
            <Avatar initials={initials} size={32} online />
          </>
        }
      />

      <View className="flex-1 bg-surface-muted px-4 pt-4 dark:bg-surface-dark">
        <PaymentSearch ref={searchInputRef} value={searchQuery} onChangeText={handleSearchChange} />

        <View className="mt-3">
          <FilterChipRow
            value={statusTab}
            options={STATUS_TABS}
            onChange={(value) => {
              setStatusTab(value);
              setPage(1);
            }}
          />
        </View>

        {isLoading ? (
          <View className="mt-4">
            {SKELETON_PLACEHOLDERS.map((key) => (
              <PaymentSkeleton key={key} />
            ))}
          </View>
        ) : (
          <FlatList
            data={pagedPayments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PaymentListItem payment={item} onPress={handleCardPress} />}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
            ListEmptyComponent={<PaymentEmptyState />}
            ListFooterComponent={
              pagedPayments.length > 0 ? <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} /> : null
            }
          />
        )}
      </View>
    </Screen>
  );
}
