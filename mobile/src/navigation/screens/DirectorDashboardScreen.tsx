import { memo, useMemo } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AnalyticsBar } from '@/components/dashboard/AnalyticsBar';
import { AppHeader } from '@/components/layout/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Screen } from '@/components/ui/Screen';
import { useGetDirectorBillStatsQuery } from '@/features/bills/api/billsApi';
import { useGetUnreadNotificationCountQuery } from '@/features/notifications/api/notificationsApi';
import { useGetDirectorQuotationStatsQuery } from '@/features/quotations/api/quotationsApi';
import { useAuth } from '@/hooks/useAuth';
import { useDrawer } from '@/navigation/context/DrawerContext';
import type { DirectorTabParamList } from '@/navigation/types';

type Props = BottomTabScreenProps<DirectorTabParamList, 'Dashboard'>;

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

export function DirectorDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const drawer = useDrawer();
  if (drawer) drawer.setTabNavigation(navigation);
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? 'U';

  const { data: stats, isLoading, isFetching, refetch } = useGetDirectorQuotationStatsQuery();
  const { data: billStats, isLoading: isLoadingBillStats } = useGetDirectorBillStatsQuery();
  const { data: unreadCount } = useGetUnreadNotificationCountQuery();

  const goToPendingQuotations = () => navigation.navigate('PendingQuotations', { screen: 'QuotationList' });
  const goToPendingBillApprovals = () => navigation.navigate('PendingBillApprovals', { screen: 'BillList' });
  const goToNotifications = () => {
    let nav = navigation as unknown as { getParent?: () => unknown; navigate: (name: string) => void };
    while (nav.getParent?.()) nav = nav.getParent!() as typeof nav;
    nav.navigate('NotificationCenter');
  };

  const isAnyLoading = isLoading || isLoadingBillStats;
  const dash = (v: number | undefined): string | number => (isAnyLoading ? '—' : (v ?? 0));

  const kpiRow1 = useMemo<KpiCardData[]>(() => [
    { id: 'q_pending', icon: 'hourglass', iconColor: '#f59e0b', iconBg: '#fef3c7', value: dash(stats?.pending), label: 'Quotations Pending', subtitle: 'Awaiting review', onPress: goToPendingQuotations },
    { id: 'q_negotiation', icon: 'chatbox-ellipses', iconColor: '#e53935', iconBg: '#fdeaea', value: dash(stats?.negotiation), label: 'In Negotiation', subtitle: 'Quotations', onPress: goToPendingQuotations },
    { id: 'q_resubmitted', icon: 'refresh-circle', iconColor: '#1e88e5', iconBg: '#dbeafe', value: dash(stats?.resubmitted), label: 'Resubmitted', subtitle: 'Quotations', onPress: goToPendingQuotations },
    { id: 'q_approved', icon: 'checkmark-circle', iconColor: '#43a047', iconBg: '#e8f5e9', value: dash(stats?.approvedToday), label: 'Approved Today', subtitle: 'Quotations' },
    { id: 'q_rejected', icon: 'close-circle', iconColor: '#e53935', iconBg: '#fdeaea', value: dash(stats?.rejectedToday), label: 'Rejected Today', subtitle: 'Quotations' },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAnyLoading, stats]);

  const kpiRow2 = useMemo<KpiCardData[]>(() => [
    { id: 'b_pending', icon: 'receipt', iconColor: '#f59e0b', iconBg: '#fef3c7', value: dash(billStats?.pendingFinancialApprovals), label: 'Financial Approvals', subtitle: 'AI-Verified Bills', onPress: goToPendingBillApprovals },
    { id: 'b_highrisk', icon: 'alert-circle', iconColor: '#e53935', iconBg: '#fdeaea', value: dash(billStats?.highRiskBills), label: 'High Risk Bills', subtitle: 'Needs attention', onPress: goToPendingBillApprovals },
    { id: 'b_approved', icon: 'checkmark-circle', iconColor: '#43a047', iconBg: '#e8f5e9', value: dash(billStats?.approvedToday), label: 'Approved Today', subtitle: 'Bills' },
    { id: 'b_correction', icon: 'pencil', iconColor: '#1e88e5', iconBg: '#dbeafe', value: dash(billStats?.correctionToday), label: 'Corrections Today', subtitle: 'Bills' },
    { id: 'notifications', icon: 'notifications', iconColor: '#e53935', iconBg: '#fdeaea', value: unreadCount ?? 0, label: 'Unread Alerts', subtitle: 'Notifications' },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAnyLoading, billStats, unreadCount]);

  const pendingTotal = (stats?.pending ?? 0) + (billStats?.pendingFinancialApprovals ?? 0);

  const tasks = useMemo(() => [
    { label: 'Pending Quotation Reviews', count: dash(stats?.pending), onPress: goToPendingQuotations },
    { label: 'Negotiation Requests', count: dash(stats?.negotiation), onPress: goToPendingQuotations },
    { label: 'Resubmitted Quotations', count: dash(stats?.resubmitted), onPress: goToPendingQuotations },
    { label: 'Pending Financial Approvals', count: dash(billStats?.pendingFinancialApprovals), onPress: goToPendingBillApprovals },
    { label: 'High Risk Bills', count: dash(billStats?.highRiskBills), onPress: goToPendingBillApprovals },
    { label: 'Unread Notifications', count: unreadCount ?? 0 },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAnyLoading, stats, billStats, unreadCount]);

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
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
      >
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.welcomeName}>{user?.name ?? 'Director'} 👋</Text>
          </View>
          <View style={[styles.roleChip, { backgroundColor: '#f3e8fd' }]}>
            <Text style={[styles.roleChipText, { color: '#7c3aed' }]}>Director</Text>
          </View>
        </View>

        {pendingTotal > 0 ? (
          <TouchableOpacity style={styles.alertBanner} onPress={goToPendingQuotations} activeOpacity={0.8}>
            <Ionicons name="alert-circle" size={15} color="#92400e" />
            <Text style={styles.alertText}>
              {pendingTotal} item{pendingTotal !== 1 ? 's' : ''} awaiting your review
            </Text>
            <Text style={styles.alertLink}>Review</Text>
          </TouchableOpacity>
        ) : null}

        <SectionHeader title="Quotation Approvals" />
        <FlatList
          data={kpiRow1}
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

        <SectionHeader title="Bill Financial Approvals" />
        <FlatList
          data={kpiRow2}
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

        <SectionHeader title="Analytics" />
        <View style={styles.listCard}>
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsGroupLabel}>Quotations Decided Today</Text>
            <AnalyticsBar
              label="Approved"
              value={stats?.approvedToday ?? 0}
              max={Math.max((stats?.approvedToday ?? 0) + (stats?.rejectedToday ?? 0), 1)}
              color="#43a047"
            />
            <AnalyticsBar
              label="Rejected"
              value={stats?.rejectedToday ?? 0}
              max={Math.max((stats?.approvedToday ?? 0) + (stats?.rejectedToday ?? 0), 1)}
              color="#e53935"
            />
          </View>
          <View style={[styles.analyticsCard, styles.analyticsDivider]}>
            <Text style={styles.analyticsGroupLabel}>Bill Financial Decisions Today</Text>
            <AnalyticsBar
              label="Approved"
              value={billStats?.approvedToday ?? 0}
              max={Math.max((billStats?.approvedToday ?? 0) + (billStats?.rejectedToday ?? 0) + (billStats?.correctionToday ?? 0), 1)}
              color="#43a047"
            />
            <AnalyticsBar
              label="Rejected"
              value={billStats?.rejectedToday ?? 0}
              max={Math.max((billStats?.approvedToday ?? 0) + (billStats?.rejectedToday ?? 0) + (billStats?.correctionToday ?? 0), 1)}
              color="#e53935"
            />
            <AnalyticsBar
              label="Sent Back for Correction"
              value={billStats?.correctionToday ?? 0}
              max={Math.max((billStats?.approvedToday ?? 0) + (billStats?.rejectedToday ?? 0) + (billStats?.correctionToday ?? 0), 1)}
              color="#f59e0b"
            />
          </View>
        </View>

        <SectionHeader title="Quick Actions" />
        <View style={styles.qaGrid}>
          <QuickAction icon="document-text" color="#f59e0b" label="Pending Quotations" onPress={goToPendingQuotations} />
          <QuickAction icon="receipt" color="#1e88e5" label="Pending Bills" onPress={goToPendingBillApprovals} />
          <QuickAction icon="person" color="#7c3aed" label="My Profile" onPress={() => navigation.navigate('Profile')} />
          <QuickAction icon="notifications" color="#e53935" label="Notifications" onPress={goToNotifications} />
        </View>

        <SectionHeader title="My Tasks" onViewAll={goToPendingQuotations} />
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

  alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderRadius: 10, marginHorizontal: 16, marginBottom: 4, padding: 10, gap: 7 },
  alertText: { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '500' },
  alertLink: { fontSize: 12, fontWeight: '700', color: '#d97706' },

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

  listCard: { backgroundColor: '#ffffff', borderRadius: 14, marginHorizontal: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 8 },
  analyticsCard: { padding: 14 },
  analyticsGroupLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  analyticsDivider: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  taskRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  taskLabel: { flex: 1, fontSize: 13, color: '#1e293b', fontWeight: '500' },
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskBadge: { backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  taskBadgeText: { fontSize: 12, fontWeight: '700', color: '#1e88e5' },
});
