import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View, type TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FilterChipRow } from '@/components/users/FilterChipRow';
import { BillCard } from '@/components/bills/BillCard';
import { BillEmptyState } from '@/components/bills/BillEmptyState';
import { BillSearch } from '@/components/bills/BillSearch';
import { BillSkeleton } from '@/components/bills/BillSkeleton';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Pagination } from '@/components/ui/Pagination';
import { Screen } from '@/components/ui/Screen';
import { ROLES } from '@/constants/roles';
import { useGetBillsQuery } from '@/features/bills/api/billsApi';
import { BILL_STATUSES, type Bill, type BillStatus } from '@/features/bills/types';
import { useAuth } from '@/hooks/useAuth';
import type { BillsStackParamList, DepartmentUserTabParamList } from '@/navigation/types';

const PAGE_SIZE = 5;
const SKELETON_PLACEHOLDERS = [1, 2, 3, 4];

const STATUS_TAB_LABEL: Record<BillStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  negotiation: 'Negotiation',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  approval_rejected: 'Rejected',
  correction_requested: 'Correction Requested',
  verified: 'Verified',
  rejected: 'Rejected',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  completed: 'Completed',
};

// Department Users only act on these statuses day-to-day; later workflow stages
// (Verified onward) are surfaced once Accounts/Payment modules are built.
const STATUS_TABS: { value: BillStatus; label: string }[] = (
  ['draft', 'submitted', 'negotiation', 'approved', 'correction_requested', 'verified', 'paid'] satisfies BillStatus[]
).map((value) => ({ value, label: STATUS_TAB_LABEL[value] }));

// Mirrors the backend's own visibility contract (`bill.service.ts` scopeToOwner) — a
// Director/CEO is never sent a draft bill, so showing that tab would be a dead end. Approved/
// approval_rejected are included so a Director/CEO can still find and act on (or review) a
// bill another approver has already decided — see the Bill Approval History.
const CEO_DIRECTOR_STATUS_TABS = (
  ['submitted', 'negotiation', 'resubmitted', 'approved', 'approval_rejected'] satisfies BillStatus[]
).map((value) => ({ value, label: STATUS_TAB_LABEL[value] }));

type Props = NativeStackScreenProps<BillsStackParamList, 'BillList'>;

export function BillListScreen({ navigation }: Props) {
  const { user, hasRole } = useAuth();
  const isCeoOrDirector = hasRole(ROLES.DIRECTOR) || hasRole(ROLES.CEO);
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const searchInputRef = useRef<TextInput>(null);

  const { data: bills, isLoading, isFetching, refetch } = useGetBillsQuery();

  const statusTabs = isCeoOrDirector ? CEO_DIRECTOR_STATUS_TABS : STATUS_TABS;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<BillStatus>(isCeoOrDirector ? 'submitted' : 'draft');
  const [page, setPage] = useState(1);

  const filteredBills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (bills ?? []).filter((item: Bill) => {
      const matchesStatus = item.status === statusTab;
      const matchesQuery = !query || item.billCode.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [bills, searchQuery, statusTab]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedBills = filteredBills.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleGoToQuotations = () =>
    navigation.getParent<BottomTabNavigationProp<DepartmentUserTabParamList>>()?.navigate('Quotations', { screen: 'QuotationList' });
  const handleCardPress = (bill: Bill) => navigation.navigate('BillDetails', { billId: bill.id });

  return (
    <Screen padded={false}>
      <AppHeader
        title="Bills"
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
        <BillSearch ref={searchInputRef} value={searchQuery} onChangeText={handleSearchChange} />

        <View className="mt-3">
          <FilterChipRow
            value={statusTab}
            options={statusTabs}
            onChange={(value) => {
              setStatusTab(value);
              setPage(1);
            }}
          />
        </View>

        {isLoading ? (
          <View className="mt-4">
            {SKELETON_PLACEHOLDERS.map((key) => (
              <BillSkeleton key={key} />
            ))}
          </View>
        ) : (
          <FlatList
            data={pagedBills}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <BillCard bill={item} onPress={handleCardPress} />}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
            ListEmptyComponent={<BillEmptyState onGoToQuotations={isCeoOrDirector ? undefined : handleGoToQuotations} />}
            ListFooterComponent={
              pagedBills.length > 0 ? <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} /> : null
            }
          />
        )}
      </View>
    </Screen>
  );
}
