import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { CeoDashboardScreen } from '@/navigation/screens/CeoDashboardScreen';
import { ComingSoonScreen } from '@/navigation/screens/ComingSoonScreen';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
import { QuotationsNavigator } from '@/navigation/QuotationsNavigator';
import { DrawerProvider } from '@/navigation/context/DrawerContext';
import { DrawerShell } from '@/navigation/DrawerShell';
import type { CeoTabParamList } from '@/navigation/types';

const CeoTab = createBottomTabNavigator<CeoTabParamList>();

function ReportsPlaceholder() {
  return <ComingSoonScreen title="Reports" icon="bar-chart" />;
}

function CeoTabs() {
  return (
    <CeoTab.Navigator
      screenOptions={{
        headerShown: false,
        // Tab bar hidden — drawer provides full navigation.
        tabBarStyle: { display: 'none' },
      }}
    >
      <CeoTab.Screen name="Dashboard" component={CeoDashboardScreen} />
      <CeoTab.Screen name="PendingQuotations" component={QuotationsNavigator} options={{ title: 'Quotations' }} />
      <CeoTab.Screen name="Reports" component={ReportsPlaceholder} />
      <CeoTab.Screen name="Profile" component={ProfileNavigator} />
    </CeoTab.Navigator>
  );
}

/** CEO — Quotation and Bill approvals within CEO Approval Limit (enforced server-side).
 *  Drawer replaces the bottom tab bar. */
export function CeoNavigator() {
  return (
    <DrawerProvider>
      <DrawerShell>
        <CeoTabs />
      </DrawerShell>
    </DrawerProvider>
  );
}
