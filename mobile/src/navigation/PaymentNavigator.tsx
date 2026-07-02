import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { PaymentsNavigator } from '@/navigation/PaymentsNavigator';
import { PaymentDashboardScreen } from '@/navigation/screens/PaymentDashboardScreen';
import { ComingSoonScreen } from '@/navigation/screens/ComingSoonScreen';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { DrawerProvider } from '@/navigation/context/DrawerContext';
import { DrawerShell } from '@/navigation/DrawerShell';
import type { PaymentTabParamList } from '@/navigation/types';

const PaymentTab = createBottomTabNavigator<PaymentTabParamList>();

function ReportsPlaceholder() {
  return <ComingSoonScreen title="Reports" icon="bar-chart" />;
}

function PaymentTabs() {
  return (
    <PaymentTab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — drawer provides full navigation.
        tabBarStyle: { display: 'none' },
      }}
    >
      <PaymentTab.Screen name="Dashboard" component={PaymentDashboardScreen} />
      <PaymentTab.Screen name="Payments" component={PaymentsNavigator} />
      <PaymentTab.Screen name="Reports" component={ReportsPlaceholder} />
      <PaymentTab.Screen name="Profile" component={ProfileNavigator} />
    </PaymentTab.Navigator>
  );
}

/** Payment Department — full Payment Module access (create, process, mark paid/completed/failed, retry).
 *  Drawer replaces the bottom tab bar. */
export function PaymentNavigator() {
  return (
    <DrawerProvider>
      <DrawerShell>
        <PaymentTabs />
      </DrawerShell>
    </DrawerProvider>
  );
}
