import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { BillsNavigator } from '@/navigation/BillsNavigator';
import { DirectorDashboardScreen } from '@/navigation/screens/DirectorDashboardScreen';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import type { DirectorTabParamList } from '@/navigation/types';

const DirectorTab = createBottomTabNavigator<DirectorTabParamList>();

const DIRECTOR_ICONS: Record<keyof DirectorTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  PendingQuotations: 'document-text',
  PendingBillApprovals: 'receipt',
  Profile: 'person',
};

/** Director only ever reviews Quotations (read-only — buttons are hidden inside the shared
 *  Quotation screens for this role) — no Vendor, Bill, or Accounts access. */
export function DirectorNavigator() {
  return (
    <DirectorTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1e88e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = DIRECTOR_ICONS[route.name as keyof DirectorTabParamList];
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
      <DirectorTab.Screen name="Dashboard" component={DirectorDashboardScreen} />
      <DirectorTab.Screen name="PendingQuotations" component={QuotationsNavigator} options={{ title: 'Quotations' }} />
      <DirectorTab.Screen name="PendingBillApprovals" component={BillsNavigator} options={{ title: 'Bills' }} />
      <DirectorTab.Screen name="Profile" component={ProfileNavigator} />
    </DirectorTab.Navigator>
  );
}
