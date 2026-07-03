import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BillsNavigator } from '@/navigation/BillsNavigator';
import { DepartmentsNavigator } from '@/navigation/DepartmentsNavigator';
import { DrawerProvider } from '@/navigation/context/DrawerContext';
import { DrawerShell } from '@/navigation/DrawerShell';
import { PaymentsNavigator } from '@/navigation/PaymentsNavigator';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { PurchaseOrdersNavigator } from '@/navigation/PurchaseOrdersNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import { UsersNavigator } from '@/navigation/UsersNavigator';
import { VendorsNavigator } from '@/navigation/VendorsNavigator';
import { ReportsScreen } from '@/navigation/screens/ReportsScreen';
import { SuperAdminDashboardScreen } from '@/navigation/screens/SuperAdminDashboardScreen';
import type { MainTabParamList } from '@/navigation/types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function SuperAdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — drawer replaces it for Super Admin.
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen name="Dashboard" component={SuperAdminDashboardScreen} />
      <Tab.Screen name="Departments" component={DepartmentsNavigator} />
      <Tab.Screen name="Users" component={UsersNavigator} />
      <Tab.Screen name="Vendors" component={VendorsNavigator} />
      <Tab.Screen name="Quotations" component={QuotationsNavigator} />
      <Tab.Screen name="Bills" component={BillsNavigator} />
      <Tab.Screen name="PurchaseOrders" component={PurchaseOrdersNavigator} options={{ title: 'Purchase Orders' }} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Payments" component={PaymentsNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

export function SuperAdminNavigator() {
  return (
    <DrawerProvider>
      <DrawerShell>
        <SuperAdminTabs />
      </DrawerShell>
    </DrawerProvider>
  );
}
