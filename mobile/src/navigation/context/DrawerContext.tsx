import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Dimensions } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import type { MainTabParamList } from '@/navigation/types';

export const DRAWER_WIDTH = Math.min(Math.round(Dimensions.get('window').width * 0.82), 320);

type TabNav = BottomTabNavigationProp<MainTabParamList>;

interface DrawerContextValue {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  translateX: Animated.Value;
  backdropOpacity: Animated.Value;
  activeTab: keyof MainTabParamList;
  setActiveTab: (tab: keyof MainTabParamList) => void;
  /** Call this from any tab screen on every render to keep the ref up to date. */
  setTabNavigation: (nav: TabNav) => void;
  /** Navigate within the Super Admin tab navigator. */
  navigateToTab: (tab: keyof MainTabParamList, params?: Record<string, unknown>) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

/** Returns null when called outside a DrawerProvider (non-Super-Admin roles). */
export function useDrawer(): DrawerContextValue | null {
  return useContext(DrawerContext);
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof MainTabParamList>('Dashboard');
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const tabNavRef = useRef<TabNav | null>(null);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 240,
        overshootClamping: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0.58,
        duration: 270,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, backdropOpacity]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: -DRAWER_WIDTH,
        useNativeDriver: true,
        damping: 22,
        stiffness: 280,
        overshootClamping: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 210,
        useNativeDriver: true,
      }),
    ]).start(() => setIsOpen(false));
  }, [translateX, backdropOpacity]);

  const setTabNavigation = useCallback((nav: TabNav) => {
    tabNavRef.current = nav;
  }, []);

  const navigateToTab = useCallback(
    (tab: keyof MainTabParamList, params?: Record<string, unknown>) => {
      if (tabNavRef.current) {
        // @ts-expect-error polymorphic navigate overloads; all valid tab names accepted
        tabNavRef.current.navigate(tab, params);
      }
    },
    [],
  );

  return (
    <DrawerContext.Provider
      value={{
        isOpen,
        openDrawer,
        closeDrawer,
        translateX,
        backdropOpacity,
        activeTab,
        setActiveTab,
        setTabNavigation,
        navigateToTab,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}
