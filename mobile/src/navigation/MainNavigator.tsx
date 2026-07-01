import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { AccountsBillsNavigator } from '@/navigation/AccountsBillsNavigator';
import { ComingSoonScreen } from '@/navigation/screens/ComingSoonScreen';
import { DepartmentUserDashboardScreen } from '@/navigation/screens/DepartmentUserDashboardScreen';
import { BillsNavigator } from '@/navigation/BillsNavigator';
import { CeoNavigator } from '@/navigation/CeoNavigator';
import { DirectorNavigator } from '@/navigation/DirectorNavigator';
import { PaymentNavigator } from '@/navigation/PaymentNavigator';
import { PaymentsNavigator } from '@/navigation/PaymentsNavigator';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import { SuperAdminNavigator } from '@/navigation/SuperAdminNavigator';
import { VendorsNavigator } from '@/navigation/VendorsNavigator';
import { ROLES } from '@/constants/roles';
import { AccountsDashboardScreen } from '@/features/accounts/screens/AccountsDashboardScreen';
import { useAuth } from '@/hooks/useAuth';
import type { AccountsTabParamList, DepartmentUserTabParamList } from '@/navigation/types';

const DepartmentUserTab = createBottomTabNavigator<DepartmentUserTabParamList>();
const AccountsTab = createBottomTabNavigator<AccountsTabParamList>();

const DEPARTMENT_USER_ICONS: Record<keyof DepartmentUserTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Vendors: 'storefront',
  Quotations: 'document-text',
  Bills: 'receipt',
  Payments: 'card',
  Profile: 'person',
};

const ACCOUNTS_ICONS: Record<keyof AccountsTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Bills: 'receipt',
  Payments: 'card',
  Profile: 'person',
};

function DepartmentUserTabs() {
  return (
    <DepartmentUserTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1e88e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = DEPARTMENT_USER_ICONS[route.name as keyof DepartmentUserTabParamList];
          const resolvedName = focused ? iconName : (`${iconName}-outline` as keyof typeof Ionicons.glyphMap);
          return <Ionicons name={resolvedName} size={size} color={color} />;
        },
        tabBarLabel: ({ color, children }) => (
          <Text className="text-[11px]" style={{ color, fontWeight: '600' }}>
            {children}
          </Text>
        ),
      })}
    >
      <DepartmentUserTab.Screen name="Dashboard" component={DepartmentUserDashboardScreen} />
      <DepartmentUserTab.Screen name="Vendors" component={VendorsNavigator} />
      <DepartmentUserTab.Screen name="Quotations" component={QuotationsNavigator} />
      <DepartmentUserTab.Screen name="Bills" component={BillsNavigator} />
      <DepartmentUserTab.Screen name="Payments" component={PaymentsNavigator} />
      <DepartmentUserTab.Screen name="Profile" component={ProfileNavigator} />
    </DepartmentUserTab.Navigator>
  );
}

function AccountsTabs() {
  return (
    <AccountsTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1e88e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = ACCOUNTS_ICONS[route.name as keyof AccountsTabParamList];
          const resolvedName = focused ? iconName : (`${iconName}-outline` as keyof typeof Ionicons.glyphMap);
          return <Ionicons name={resolvedName} size={size} color={color} />;
        },
        tabBarLabel: ({ color, children }) => (
          <Text className="text-[11px]" style={{ color, fontWeight: '600' }}>
            {children}
          </Text>
        ),
      })}
    >
      <AccountsTab.Screen name="Dashboard" component={AccountsDashboardScreen} />
      <AccountsTab.Screen name="Bills" component={AccountsBillsNavigator} />
      <AccountsTab.Screen name="Payments" component={PaymentsNavigator} />
      <AccountsTab.Screen name="Profile" component={ProfileNavigator} />
    </AccountsTab.Navigator>
  );
}

function ReportsScreen() {
  return <ComingSoonScreen title="Reports" icon="bar-chart" />;
}

/**
 * Role-based route protection: every role gets its own navigator. Super Admin now uses a
 * drawer-based navigator (SuperAdminNavigator) instead of a bottom tab bar.
 */
export function MainNavigator() {
  const { hasRole } = useAuth();
  if (hasRole(ROLES.SUPER_ADMIN)) return <SuperAdminNavigator />;
  if (hasRole(ROLES.ACCOUNTS)) return <AccountsTabs />;
  if (hasRole(ROLES.DIRECTOR)) return <DirectorNavigator />;
  if (hasRole(ROLES.CEO)) return <CeoNavigator />;
  if (hasRole(ROLES.PAYMENT_DEPARTMENT)) return <PaymentNavigator />;
  return <DepartmentUserTabs />;
}

// Keep ReportsScreen available for any legacy imports (none currently, but safe to export).
export { ReportsScreen };
