import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BillsNavigator } from '@/navigation/BillsNavigator';
import { DirectorDashboardScreen } from '@/navigation/screens/DirectorDashboardScreen';
import { ComingSoonScreen } from '@/navigation/screens/ComingSoonScreen';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { PurchaseOrdersNavigator } from '@/navigation/PurchaseOrdersNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import { DrawerProvider } from '@/navigation/context/DrawerContext';
import { DrawerShell } from '@/navigation/DrawerShell';
import type { DirectorTabParamList } from '@/navigation/types';

const DirectorTab = createBottomTabNavigator<DirectorTabParamList>();

function ReportsPlaceholder() {
  return <ComingSoonScreen title="Reports" icon="bar-chart" />;
}

function DirectorTabs() {
  return (
    <DirectorTab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — drawer provides full navigation.
        tabBarStyle: { display: 'none' },
      }}
    >
      <DirectorTab.Screen name="Dashboard" component={DirectorDashboardScreen} />
      <DirectorTab.Screen name="PendingQuotations" component={QuotationsNavigator} options={{ title: 'Quotations' }} />
      <DirectorTab.Screen name="PendingBillApprovals" component={BillsNavigator} options={{ title: 'Bills' }} />
      <DirectorTab.Screen name="PurchaseOrders" component={PurchaseOrdersNavigator} options={{ title: 'Purchase Orders' }} />
      <DirectorTab.Screen name="Reports" component={ReportsPlaceholder} />
      <DirectorTab.Screen name="Profile" component={ProfileNavigator} />
    </DirectorTab.Navigator>
  );
}

/** Director — Quotation and Bill reviews (read-only, role-gated inside shared screens).
 *  Drawer replaces the bottom tab bar. */
export function DirectorNavigator() {
  return (
    <DrawerProvider>
      <DrawerShell>
        <DirectorTabs />
      </DrawerShell>
    </DrawerProvider>
  );
}
