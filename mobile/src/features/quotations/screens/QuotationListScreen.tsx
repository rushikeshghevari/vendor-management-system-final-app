import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View, type TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FilterChipRow } from '@/components/users/FilterChipRow';
import { QuotationCard } from '@/components/quotations/QuotationCard';
import { QuotationEmptyState } from '@/components/quotations/QuotationEmptyState';
import { QuotationSearch } from '@/components/quotations/QuotationSearch';
import { QuotationSkeleton } from '@/components/quotations/QuotationSkeleton';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Fab } from '@/components/ui/Fab';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Pagination } from '@/components/ui/Pagination';
import { Screen } from '@/components/ui/Screen';
import { ROLES } from '@/constants/roles';
import { useGetQuotationsQuery } from '@/features/quotations/api/quotationsApi';
import { QUOTATION_STATUSES, type Quotation, type QuotationStatus } from '@/features/quotations/types';
import { useAuth } from '@/hooks/useAuth';
import type { QuotationsStackParamList } from '@/navigation/types';

const PAGE_SIZE = 5;
const SKELETON_PLACEHOLDERS = [1, 2, 3, 4];

const STATUS_TAB_LABEL: Record<QuotationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  negotiation: 'Negotiation',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  rejected: 'Rejected',
  billed: 'Billed',
};

const ALL_STATUS_TABS = QUOTATION_STATUSES.map((value) => ({ value, label: STATUS_TAB_LABEL[value] }));

// Mirrors the backend's own visibility contract (`quotation.service.ts` scopeToOwner) — a
// Director is never sent draft/billed quotations, so showing those tabs would just be
// permanently-empty dead ends. Approved/Rejected are included (not just Submitted/
// Negotiation/Resubmitted) so a Director can still find and independently act on a
// quotation another Director has already decided — see the Director Approval History.
const DIRECTOR_STATUS_TABS = (
  ['submitted', 'negotiation', 'resubmitted', 'approved', 'rejected'] satisfies QuotationStatus[]
).map((value) => ({ value, label: STATUS_TAB_LABEL[value] }));

type Props = NativeStackScreenProps<QuotationsStackParamList, 'QuotationList'>;

export function QuotationListScreen({ navigation }: Props) {
  const { user, hasRole } = useAuth();
  const isDirector = hasRole(ROLES.DIRECTOR);
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const searchInputRef = useRef<TextInput>(null);

  const { data: quotations, isLoading, isFetching, refetch } = useGetQuotationsQuery();

  const statusTabs = isDirector ? DIRECTOR_STATUS_TABS : ALL_STATUS_TABS;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<QuotationStatus>(isDirector ? 'submitted' : 'draft');
  const [page, setPage] = useState(1);

  const filteredQuotations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (quotations ?? []).filter((item: Quotation) => {
      const matchesStatus = item.status === statusTab;
      const matchesQuery = !query || item.quotationCode.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [quotations, searchQuery, statusTab]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotations.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedQuotations = filteredQuotations.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleAddQuotation = () => navigation.navigate('CreateQuotation');
  const handleCardPress = (quotation: Quotation) => navigation.navigate('QuotationDetails', { quotationId: quotation.id });

  return (
    <Screen padded={false}>
      <AppHeader
        title="Quotations"
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
        <QuotationSearch ref={searchInputRef} value={searchQuery} onChangeText={handleSearchChange} />

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
              <QuotationSkeleton key={key} />
            ))}
          </View>
        ) : (
          <FlatList
            data={pagedQuotations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <QuotationCard quotation={item} onPress={handleCardPress} />}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
            ListEmptyComponent={<QuotationEmptyState onAddPress={isDirector ? undefined : handleAddQuotation} />}
            ListFooterComponent={
              pagedQuotations.length > 0 ? (
                <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
              ) : null
            }
          />
        )}
      </View>

      {!isDirector ? (
        <View className="absolute bottom-6 right-6">
          <Fab accessibilityLabel="Create Quotation" onPress={handleAddQuotation} />
        </View>
      ) : null}
    </Screen>
  );
}
