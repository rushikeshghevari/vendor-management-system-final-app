import { memo, useMemo } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AnalyticsBar } from '@/components/dashboard/AnalyticsBar';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Screen } from '@/components/ui/Screen';
import { useGetBillsQuery } from '@/features/bills/api/billsApi';
import { useGetUnreadNotificationCountQuery } from '@/features/notifications/api/notificationsApi';
import { useGetMyPaymentStatsQuery } from '@/features/payments/api/paymentsApi';
import { useGetQuotationsQuery } from '@/features/quotations/api/quotationsApi';
import { useGetVendorsQuery } from '@/features/vendors/api/vendorsApi';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/navigation/context/DrawerContext';
import type { DepartmentUserTabParamList } from '@/navigation/types';

type Props = BottomTabScreenProps<DepartmentUserTabParamList, 'Dashboard'>;

const KPI_CARD_WIDTH = 130;
const KPI_SNAP_INTERVAL = KPI_CARD_WIDTH + 10;

interface KpiCardData {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  subtitle: string;
  onPress?: () => void;
}

const KpiCard = memo(function KpiCard({ icon, iconColor, iconBg, value, label, subtitle, onPress }: KpiCardData) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.72 : 1} style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as never} size={19} color={iconColor} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.kpiSubtitle} numberOfLines={1}>{subtitle}</Text>
    </TouchableOpacity>
  );
});

interface QuickActionData { icon: string; color: string; label: string; onPress: () => void; }
const QuickAction = memo(function QuickAction({ icon, color, label, onPress }: QuickActionData) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.qaItem} activeOpacity={0.72}>
      <View style={[styles.qaIconWrap, { backgroundColor: `${color}1a` }]}>
        <Ionicons name={icon as never} size={22} color={color} />
      </View>
      <Text style={styles.qaLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
});

function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onViewAll ? (
        <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function DepartmentUserDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const drawer = useDrawer();
  // Register tab nav so drawer can switch tabs from any screen.
  if (drawer) drawer.setTabNavigation(navigation);
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? 'U';

  const { data: vendors, isLoading: isLoadingVendors, refetch: refetchVendors } = useGetVendorsQuery();
  const { data: quotations, isLoading: isLoadingQuotations, refetch: refetchQuotations } = useGetQuotationsQuery();
  const { data: bills, isLoading: isLoadingBills, refetch: refetchBills } = useGetBillsQuery();
  const { data: paymentStats, isLoading: isLoadingPaymentStats } = useGetMyPaymentStatsQuery();
  const { data: unreadCount } = useGetUnreadNotificationCountQuery();

  const isLoading = isLoadingVendors || isLoadingQuotations || isLoadingBills;
  const isFetching = isLoading;
  const refetch = () => { refetchVendors(); refetchQuotations(); refetchBills(); };

  const dash = (v: number | undefined): string | number => (isLoading ? '—' : (v ?? 0));

  const countQ = (status: string) => (quotations ?? []).filter((q) => q.status === status).length;
  const countB = (status: string) => (bills ?? []).filter((b) => b.status === status).length;

  const waitingForCeo = useMemo(
    () => (quotations ?? []).filter((q) => (q.status === 'submitted' || q.status === 'resubmitted') && q.approvalRoute === 'ceo').length,
    [quotations],
  );
  const waitingForDirectors = useMemo(
    () => (quotations ?? []).filter((q) => (q.status === 'submitted' || q.status === 'resubmitted') && q.approvalRoute === 'directors').length,
    [quotations],
  );

  const kpiRowQuotations = useMemo<KpiCardData[]>(() => [
    { id: 'q_draft', icon: 'document-text', iconColor: '#f59e0b', iconBg: '#fef3c7', value: dash(countQ('draft')), label: 'Draft Quotations', subtitle: 'Not submitted', onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
    { id: 'q_submitted', icon: 'paper-plane', iconColor: '#1e88e5', iconBg: '#dbeafe', value: dash(countQ('submitted')), label: 'Submitted', subtitle: 'Pending review', onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
    { id: 'q_approved', icon: 'checkmark-circle', iconColor: '#43a047', iconBg: '#e8f5e9', value: dash(countQ('approved')), label: 'Approved', subtitle: 'Quotations', onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
    { id: 'q_negotiation', icon: 'chatbox-ellipses', iconColor: '#e53935', iconBg: '#fdeaea', value: dash(countQ('negotiation')), label: 'Negotiation', subtitle: 'Needs update', onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
    { id: 'q_rejected', icon: 'close-circle', iconColor: '#e53935', iconBg: '#fdeaea', value: dash(countQ('rejected')), label: 'Rejected', subtitle: 'Quotations', onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isLoading, quotations]);

  const kpiRowBills = useMemo<KpiCardData[]>(() => [
    { id: 'b_draft', icon: 'receipt', iconColor: '#f59e0b', iconBg: '#fef3c7', value: dash(countB('draft')), label: 'Draft Bills', subtitle: 'Not submitted', onPress: () => navigation.navigate('Bills', { screen: 'BillList' }) },
    { id: 'b_pending', icon: 'paper-plane', iconColor: '#1e88e5', iconBg: '#dbeafe', value: dash(countB('submitted') + countB('resubmitted')), label: 'Pending Approval', subtitle: 'Bills awaiting', onPress: () => navigation.navigate('Bills', { screen: 'BillList' }) },
    { id: 'b_approved', icon: 'checkmark-circle', iconColor: '#43a047', iconBg: '#e8f5e9', value: dash(countB('approved')), label: 'Approved', subtitle: 'Bills', onPress: () => navigation.navigate('Bills', { screen: 'BillList' }) },
    { id: 'b_verified', icon: 'shield-checkmark', iconColor: '#00897b', iconBg: '#e3f4f2', value: dash(countB('verified')), label: 'Verified', subtitle: 'Bills', onPress: () => navigation.navigate('Bills', { screen: 'BillList' }) },
    { id: 'b_correction', icon: 'create', iconColor: '#e53935', iconBg: '#fdeaea', value: dash(countB('correction_requested')), label: 'Correction Req.', subtitle: 'Needs update', onPress: () => navigation.navigate('Bills', { screen: 'BillList' }) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isLoading, bills]);

  const kpiRowPayments = useMemo<KpiCardData[]>(() => [
    { id: 'vend', icon: 'storefront', iconColor: '#7c3aed', iconBg: '#f3e8fd', value: dash((vendors ?? []).length), label: 'My Vendors', subtitle: 'Registered', onPress: () => navigation.navigate('Vendors', { screen: 'VendorList' }) },
    { id: 'pay_total', icon: 'card', iconColor: '#1e88e5', iconBg: '#dbeafe', value: isLoadingPaymentStats ? '—' : (paymentStats?.myPayments ?? 0), label: 'My Payments', subtitle: 'All time', onPress: () => navigation.navigate('Payments', { screen: 'PaymentList' }) },
    { id: 'pay_pending', icon: 'hourglass', iconColor: '#f59e0b', iconBg: '#fef3c7', value: isLoadingPaymentStats ? '—' : (paymentStats?.pending ?? 0), label: 'Pending Payments', subtitle: 'Processing' },
    { id: 'pay_done', icon: 'checkmark-done', iconColor: '#43a047', iconBg: '#e8f5e9', value: isLoadingPaymentStats ? '—' : (paymentStats?.completed ?? 0), label: 'Completed', subtitle: 'Payments', onPress: () => navigation.navigate('Payments', { screen: 'PaymentList', params: { initialStatus: 'completed' } }) },
    { id: 'notifications', icon: 'notifications', iconColor: '#e53935', iconBg: '#fdeaea', value: unreadCount ?? 0, label: 'Unread Alerts', subtitle: 'Notifications' },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isLoading, isLoadingPaymentStats, vendors, paymentStats, unreadCount]);

  const tasks = useMemo(() => [
    { label: 'Waiting for CEO Approval', count: isLoading ? '—' : waitingForCeo, onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
    { label: 'Waiting for Director Approval', count: isLoading ? '—' : waitingForDirectors, onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
    { label: 'Negotiation Required', count: isLoading ? '—' : countQ('negotiation'), onPress: () => navigation.navigate('Quotations', { screen: 'QuotationList' }) },
    { label: 'Bills Pending Approval', count: isLoading ? '—' : countB('submitted') + countB('resubmitted'), onPress: () => navigation.navigate('Bills', { screen: 'BillList' }) },
    { label: 'Bills Returned (Correction)', count: isLoading ? '—' : countB('correction_requested'), onPress: () => navigation.navigate('Bills', { screen: 'BillList' }) },
    { label: 'Unread Notifications', count: unreadCount ?? 0 },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isLoading, quotations, bills, waitingForCeo, waitingForDirectors, unreadCount]);

  const totalQ = (quotations ?? []).length;
  const approvedQ = countQ('approved');
  const totalB = (bills ?? []).length;
  const verifiedB = countB('verified');

  const goToNotifications = () => {
    let nav = navigation as unknown as { getParent?: () => unknown; navigate: (name: string) => void };
    while (nav.getParent?.()) nav = nav.getParent!() as typeof nav;
    nav.navigate('NotificationCenter');
  };

  return (
    <Screen padded={false} className="bg-surface-muted dark:bg-surface-dark">
      <AppHeader
        variant="brand"
        onLeftPress={() => drawer?.openDrawer()}
        rightSlot={
          <>
            <NotificationBell size={24} color="#212121" />
            <Avatar initials={initials} online />
          </>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.welcomeName}>{user?.name ?? 'there'} 👋</Text>
          </View>
          <View style={[styles.roleChip, { backgroundColor: '#e8f5e9' }]}>
            <Text style={[styles.roleChipText, { color: '#43a047' }]}>Dept. User</Text>
          </View>
        </View>

        <SectionHeader title="My Quotations" onViewAll={() => navigation.navigate('Quotations', { screen: 'QuotationList' })} />
        <FlatList
          data={kpiRowQuotations}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiListContent}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          renderItem={({ item }) => <KpiCard {...item} />}
          snapToInterval={KPI_SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
        />

        <SectionHeader title="My Bills" onViewAll={() => navigation.navigate('Bills', { screen: 'BillList' })} />
        <FlatList
          data={kpiRowBills}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiListContent}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          renderItem={({ item }) => <KpiCard {...item} />}
          snapToInterval={KPI_SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
        />

        <SectionHeader title="Vendors & Payments" onViewAll={() => navigation.navigate('Payments', { screen: 'PaymentList' })} />
        <FlatList
          data={kpiRowPayments}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiListContent}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          renderItem={({ item }) => <KpiCard {...item} />}
          snapToInterval={KPI_SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
        />

        <SectionHeader title="Quick Actions" />
        <View style={styles.qaGrid}>
          <QuickAction icon="document-text" color="#f59e0b" label="Create Quotation" onPress={() => navigation.navigate('Quotations', { screen: 'CreateQuotation' })} />
          <QuickAction icon="storefront" color="#7c3aed" label="Add Vendor" onPress={() => navigation.navigate('Vendors', { screen: 'AddVendor' })} />
          <QuickAction icon="receipt" color="#1e88e5" label="My Bills" onPress={() => navigation.navigate('Bills', { screen: 'BillList' })} />
          <QuickAction icon="notifications" color="#e53935" label="Notifications" onPress={goToNotifications} />
        </View>

        <SectionHeader title="Analytics" />
        <View style={styles.analyticsCard}>
          <AnalyticsBar label="Quotations Approved" value={approvedQ} max={Math.max(totalQ, 1)} color="#10b981" />
          <View style={styles.analyticsDivider} />
          <AnalyticsBar label="Bills Verified" value={verifiedB} max={Math.max(totalB, 1)} color="#3b82f6" />
        </View>

        <SectionHeader title="My Tasks" onViewAll={() => navigation.navigate('Quotations', { screen: 'QuotationList' })} />
        <View style={styles.listCard}>
          {tasks.map((task, idx) => (
            <TouchableOpacity
              key={task.label}
              onPress={task.onPress}
              activeOpacity={task.onPress ? 0.72 : 1}
              style={[styles.taskRow, idx < tasks.length - 1 && styles.taskRowBorder]}
            >
              <Text style={styles.taskLabel}>{task.label}</Text>
              <View style={styles.taskRight}>
                <View style={styles.taskBadge}>
                  <Text style={styles.taskBadgeText}>{task.count}</Text>
                </View>
                {task.onPress ? <Ionicons name="chevron-forward" size={14} color="#94a3b8" /> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  welcomeText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  welcomeName: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  roleChip: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4 },
  roleChipText: { fontSize: 10, fontWeight: '700' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 9 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.9 },
  viewAll: { fontSize: 12, fontWeight: '600', color: '#1e88e5' },

  kpiListContent: { paddingHorizontal: 16, paddingBottom: 2 },
  kpiCard: { width: KPI_CARD_WIDTH, backgroundColor: '#ffffff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  kpiIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: '800', color: '#0f172a', lineHeight: 28 },
  kpiLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginTop: 4 },
  kpiSubtitle: { fontSize: 10, color: '#94a3b8', marginTop: 2 },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  qaItem: { width: '48%', backgroundColor: '#ffffff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  qaIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#334155', lineHeight: 16 },

  analyticsCard: { backgroundColor: '#ffffff', borderRadius: 14, marginHorizontal: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  analyticsDivider: { height: 12 },

  listCard: { backgroundColor: '#ffffff', borderRadius: 14, marginHorizontal: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 8 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  taskRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  taskLabel: { flex: 1, fontSize: 13, color: '#1e293b', fontWeight: '500' },
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskBadge: { backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  taskBadgeText: { fontSize: 12, fontWeight: '700', color: '#1e88e5' },
});
