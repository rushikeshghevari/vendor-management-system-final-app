import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { DrawerContent } from '@/components/layout/DrawerContent';
import { DrawerProvider, DRAWER_WIDTH, useDrawer } from '@/navigation/context/DrawerContext';
import { BillsNavigator } from '@/navigation/BillsNavigator';
import { DepartmentsNavigator } from '@/navigation/DepartmentsNavigator';
import { PaymentsNavigator } from '@/navigation/PaymentsNavigator';
import { ProfileNavigator } from '@/navigation/ProfileNavigator';
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
        // Tab bar is entirely hidden — the drawer replaces it for Super Admin.
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen name="Dashboard" component={SuperAdminDashboardScreen} />
      <Tab.Screen name="Departments" component={DepartmentsNavigator} />
      <Tab.Screen name="Users" component={UsersNavigator} />
      <Tab.Screen name="Vendors" component={VendorsNavigator} />
      <Tab.Screen name="Quotations" component={QuotationsNavigator} />
      <Tab.Screen name="Bills" component={BillsNavigator} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Payments" component={PaymentsNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

function SuperAdminNavigatorInner() {
  const drawer = useDrawer();
  if (!drawer) return <SuperAdminTabs />;

  const { isOpen, closeDrawer, translateX, backdropOpacity } = drawer;

  // Intercept Android hardware back button to close drawer when open.
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, closeDrawer]);

  return (
    <View style={styles.root}>
      {/* Main content — always visible behind the drawer */}
      <SuperAdminTabs />

      {/* Backdrop — always rendered but pointer-events controlled by isOpen */}
      <Animated.View
        pointerEvents={isOpen ? 'box-only' : 'none'}
        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer panel — always rendered, slides off-screen at −DRAWER_WIDTH when closed */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <DrawerContent />
      </Animated.View>
    </View>
  );
}

export function SuperAdminNavigator() {
  return (
    <DrawerProvider>
      <SuperAdminNavigatorInner />
    </DrawerProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: '#000000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    // Elevation / shadow so the drawer clearly floats above content.
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
});
