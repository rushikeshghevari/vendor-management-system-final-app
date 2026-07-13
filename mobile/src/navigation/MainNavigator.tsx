import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AccountsBillsNavigator } from '@/navigation/AccountsBillsNavigator';
import { ComingSoonScreen } from '@/navigation/screens/ComingSoonScreen';
import { DepartmentUserDashboardScreen } from '@/navigation/screens/DepartmentUserDashboardScreen';
import { BillsNavigator } from '@/navigation/BillsNavigator';
import { CeoNavigator } from '@/navigation/CeoNavigator';
import { DirectorNavigator } from '@/navigation/DirectorNavigator';
import { HodNavigator } from '@/navigation/HodNavigator';
import { PaymentNavigator } from '@/navigation/PaymentNavigator';
import { PaymentsNavigator } from '@/navigation/PaymentsNavigator';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { PurchaseOrdersNavigator } from '@/navigation/PurchaseOrdersNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import { SuperAdminNavigator } from '@/navigation/SuperAdminNavigator';
import { VendorsNavigator } from '@/navigation/VendorsNavigator';
import { DrawerProvider } from '@/navigation/context/DrawerContext';
import { DrawerShell } from '@/navigation/DrawerShell';
import { ROLES } from '@/constants/roles';
import { AccountsDashboardScreen } from '@/features/accounts/screens/AccountsDashboardScreen';
import { useAuth } from '@/hooks/useAuth';
import type { AccountsTabParamList, DepartmentUserTabParamList } from '@/navigation/types';

const DepartmentUserTab = createBottomTabNavigator<DepartmentUserTabParamList>();
const AccountsTab = createBottomTabNavigator<AccountsTabParamList>();

function ReportsPlaceholder() {
  return <ComingSoonScreen title="Reports" icon="bar-chart" />;
}

function DepartmentUserTabs() {
  return (
    <DepartmentUserTab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — drawer provides full navigation.
        tabBarStyle: { display: 'none' },
      }}
    >
      <DepartmentUserTab.Screen name="Dashboard" component={DepartmentUserDashboardScreen} />
      <DepartmentUserTab.Screen name="Vendors" component={VendorsNavigator} />
      <DepartmentUserTab.Screen name="Quotations" component={QuotationsNavigator} />
      <DepartmentUserTab.Screen name="Bills" component={BillsNavigator} />
      <DepartmentUserTab.Screen name="PurchaseOrders" component={PurchaseOrdersNavigator} options={{ title: 'Purchase Orders' }} />
      <DepartmentUserTab.Screen name="Payments" component={PaymentsNavigator} />
      <DepartmentUserTab.Screen name="Profile" component={ProfileNavigator} />
    </DepartmentUserTab.Navigator>
  );
}

function DepartmentUserNavigator() {
  return (
    <DrawerProvider>
      <DrawerShell>
        <DepartmentUserTabs />
      </DrawerShell>
    </DrawerProvider>
  );
}

function AccountsTabs() {
  return (
    <AccountsTab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — drawer provides full navigation.
        tabBarStyle: { display: 'none' },
      }}
    >
      <AccountsTab.Screen name="Dashboard" component={AccountsDashboardScreen} />
      <AccountsTab.Screen name="Bills" component={AccountsBillsNavigator} />
      <AccountsTab.Screen name="PurchaseOrders" component={PurchaseOrdersNavigator} options={{ title: 'Purchase Orders' }} />
      <AccountsTab.Screen name="Payments" component={PaymentsNavigator} />
      <AccountsTab.Screen name="Reports" component={ReportsPlaceholder} />
      <AccountsTab.Screen name="Profile" component={ProfileNavigator} />
    </AccountsTab.Navigator>
  );
}

function AccountsNavigator() {
  return (
    <DrawerProvider>
      <DrawerShell>
        <AccountsTabs />
      </DrawerShell>
    </DrawerProvider>
  );
}

/**
 * Role-based route protection: every role gets its own navigator.
 * All roles use a drawer-based navigator — the drawer replaces the bottom tab bar.
 */
export function MainNavigator() {
  const { hasRole } = useAuth();
  if (hasRole(ROLES.SUPER_ADMIN))        return <SuperAdminNavigator />;
  if (hasRole(ROLES.HOD))                return <HodNavigator />;
  if (hasRole(ROLES.ACCOUNTS))           return <AccountsNavigator />;
  if (hasRole(ROLES.DIRECTOR))           return <DirectorNavigator />;
  if (hasRole(ROLES.CEO))                return <CeoNavigator />;
  if (hasRole(ROLES.PAYMENT_DEPARTMENT)) return <PaymentNavigator />;
  return <DepartmentUserNavigator />;
}
