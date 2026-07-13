import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BillsNavigator } from '@/navigation/BillsNavigator';
import { DrawerProvider } from '@/navigation/context/DrawerContext';
import { DrawerShell } from '@/navigation/DrawerShell';
import { HodDashboardScreen } from '@/navigation/screens/HodDashboardScreen';
import { HodUsersNavigator } from '@/navigation/HodUsersNavigator';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { PurchaseOrdersNavigator } from '@/navigation/PurchaseOrdersNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import { VendorsNavigator } from '@/navigation/VendorsNavigator';
import type { HodTabParamList } from '@/navigation/types';

const HodTab = createBottomTabNavigator<HodTabParamList>();

function HodTabs() {
  return (
    <HodTab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — drawer provides full navigation.
        tabBarStyle: { display: 'none' },
      }}
    >
      <HodTab.Screen name="Dashboard" component={HodDashboardScreen} />
      <HodTab.Screen name="Users" component={HodUsersNavigator} />
      <HodTab.Screen name="Vendors" component={VendorsNavigator} />
      <HodTab.Screen name="Quotations" component={QuotationsNavigator} />
      <HodTab.Screen name="Bills" component={BillsNavigator} />
      <HodTab.Screen name="PurchaseOrders" component={PurchaseOrdersNavigator} options={{ title: 'Purchase Orders' }} />
      <HodTab.Screen name="Profile" component={ProfileNavigator} />
    </HodTab.Navigator>
  );
}

/** HOD — department-wide access to Users (via /hod/users), Vendors, Quotations, Bills, and
 *  Purchase Orders (reusing the same navigators/screens Department User uses — the backend
 *  scopes those endpoints to the HOD's whole department, not just self-created records). */
export function HodNavigator() {
  return (
    <DrawerProvider>
      <DrawerShell>
        <HodTabs />
      </DrawerShell>
    </DrawerProvider>
  );
}
