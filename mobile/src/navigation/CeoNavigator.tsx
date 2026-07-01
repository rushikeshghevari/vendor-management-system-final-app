import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { BillsNavigator } from '@/navigation/BillsNavigator';
import { CeoDashboardScreen } from '@/navigation/screens/CeoDashboardScreen';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import type { CeoTabParamList } from '@/navigation/types';

const CeoTab = createBottomTabNavigator<CeoTabParamList>();

const CEO_ICONS: Record<keyof CeoTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  PendingQuotations: 'document-text',
  PendingBillApprovals: 'receipt',
  Profile: 'person',
};

/** Mirrors DirectorNavigator exactly — the CEO only ever reviews Quotations within the CEO
 *  Approval Limit (enforced server-side in quotationService.scopeToOwner/decide). */
export function CeoNavigator() {
  return (
    <CeoTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1e88e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = CEO_ICONS[route.name as keyof CeoTabParamList];
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
      <CeoTab.Screen name="Dashboard" component={CeoDashboardScreen} />
      <CeoTab.Screen name="PendingQuotations" component={QuotationsNavigator} options={{ title: 'Quotations' }} />
      <CeoTab.Screen name="PendingBillApprovals" component={BillsNavigator} options={{ title: 'Bills' }} />
      <CeoTab.Screen name="Profile" component={ProfileNavigator} />
    </CeoTab.Navigator>
  );
}
