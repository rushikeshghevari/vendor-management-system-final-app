import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { PaymentsNavigator } from '@/navigation/PaymentsNavigator';
import { PaymentDashboardScreen } from '@/navigation/screens/PaymentDashboardScreen';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import type { PaymentTabParamList } from '@/navigation/types';

const PaymentTab = createBottomTabNavigator<PaymentTabParamList>();

const PAYMENT_ICONS: Record<keyof PaymentTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Payments: 'card',
  Profile: 'person',
};

/** Payment Department — full Payment Module access (create, process, mark paid/completed/failed, retry). */
export function PaymentNavigator() {
  return (
    <PaymentTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1e88e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ color, size, focused }) => {
          const iconName = PAYMENT_ICONS[route.name as keyof PaymentTabParamList];
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
      <PaymentTab.Screen name="Dashboard" component={PaymentDashboardScreen} />
      <PaymentTab.Screen name="Payments" component={PaymentsNavigator} />
      <PaymentTab.Screen name="Profile" component={ProfileNavigator} />
    </PaymentTab.Navigator>
  );
}
