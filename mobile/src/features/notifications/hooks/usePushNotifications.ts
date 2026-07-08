/**
 * FCM push notification lifecycle hook.
 *
 * Responsibilities:
 *  1. Request Android 13+ / iOS notification permissions
 *  2. Create 5 Android notification channels
 *  3. Register Notification Action Categories (Approve/Reject/Open, Confirm/Open)
 *  4. Get native FCM device token → register with backend
 *  5. Register background task for silent (data-only) pushes
 *  6. Handle killed-app launch via getLastNotificationResponseAsync
 *  7. Foreground + background notification responses (deep link routing + badge management)
 *  8. Token refresh auto re-registration
 *  9. Unregister on logout
 *
 * Mount once inside AuthenticatedNavigator (inside NavigationContainer).
 */

import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useRegisterDeviceMutation, useRemoveDeviceMutation } from '@/features/notifications/api/notificationsApi';
import {
  registerBackgroundNotificationTask,
} from '@/features/notifications/services/backgroundNotificationTask';
import {
  resolveDeepLinkTarget,
  getNotificationData,
  DEFAULT_ACTION_IDENTIFIER,
} from '@/features/notifications/services/notificationDeepLink';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from '@/navigation/types';

// Global handler: show alert banner when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ── Channel definitions ───────────────────────────────────────────────────────

async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('vms_default', {
    name: 'VMS General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('vms_approvals', {
    name: 'VMS Approvals',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#D97706',
    enableVibrate: true,
    showBadge: true,
    description: 'Quotation and bill approval requests',
  });

  await Notifications.setNotificationChannelAsync('vms_critical', {
    name: 'VMS Critical Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    lightColor: '#DC2626',
    enableVibrate: true,
    showBadge: true,
    bypassDnd: true,
    description: 'Critical system alerts that bypass Do Not Disturb',
  });

  await Notifications.setNotificationChannelAsync('vms_payments', {
    name: 'VMS Payments',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 150, 300],
    lightColor: '#16A34A',
    enableVibrate: true,
    showBadge: true,
    description: 'Payment status updates',
  });

  await Notifications.setNotificationChannelAsync('vms_silent', {
    name: 'VMS Silent Updates',
    importance: Notifications.AndroidImportance.MIN,
    enableVibrate: false,
    showBadge: false,
    description: 'Silent background sync notifications',
  });
}

// ── Action categories ─────────────────────────────────────────────────────────

async function registerNotificationCategories(): Promise<void> {
  // Approval action buttons (Quotation / Bill)
  await Notifications.setNotificationCategoryAsync('vms_approval_action', [
    {
      identifier: 'approve',
      buttonTitle: 'Approve',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'reject',
      buttonTitle: 'Reject',
      options: { opensAppToForeground: true, isDestructive: true },
    },
    {
      identifier: 'open',
      buttonTitle: 'View Details',
      options: { opensAppToForeground: true },
    },
  ]);

  // Payment action buttons
  await Notifications.setNotificationCategoryAsync('vms_payment_action', [
    {
      identifier: 'open',
      buttonTitle: 'View Payment',
      options: { opensAppToForeground: true },
    },
  ]);

  // Generic info action
  await Notifications.setNotificationCategoryAsync('vms_info_action', [
    {
      identifier: 'open',
      buttonTitle: 'Open',
      options: { opensAppToForeground: true },
    },
  ]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDeviceId(): string {
  return Device.osBuildFingerprint ?? Device.modelId ?? 'unknown-device';
}

function getDeviceName(): string {
  return Device.deviceName ?? Device.modelName ?? 'Unknown Device';
}

function getPlatform(): 'android' | 'ios' | 'web' {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return 'web';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const [registerDevice] = useRegisterDeviceMutation();
  const [removeDevice]   = useRemoveDeviceMutation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const notificationListener = useRef<Subscription | null>(null);
  const responseListener     = useRef<Subscription | null>(null);
  const registeredTokenRef   = useRef<string | null>(null);
  const deviceIdRef          = useRef<string>(getDeviceId());

  /** Navigate to the resource the notification refers to */
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = getNotificationData(response);
      const target = resolveDeepLinkTarget(data);
      if (!target) return;

      if (target.rootScreen === 'QuotationApproval') {
        // Director/CEO approval notifications bypass the notification list entirely and open
        // the dedicated approval screen in one tap.
        navigation.navigate('QuotationApproval', {
          quotationId: target.params.quotationId ?? '',
          notificationId: target.params.notificationId,
        });
        return;
      }

      if (target.rootScreen === 'BillFinancialApproval') {
        // Director Financial Approval notifications open the dedicated approval screen directly.
        navigation.navigate('BillFinancialApproval', {
          billId: target.params.billId ?? '',
          notificationId: target.params.notificationId,
        });
        return;
      }

      // All other modules: open the Notification Center so the user sees the context before
      // navigating into the module. The notification list's "View" button handles the final hop.
      navigation.navigate('NotificationCenter', { screen: 'NotificationList', params: undefined });
    },
    [navigation],
  );

  const requestPermissionsAndRegister = useCallback(async () => {
    if (!Device.isDevice) {
      console.info('[push] Skipping FCM registration — not a physical device');
      return;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.info('[push] Push notification permission not granted');
      return;
    }

    // Create channels and action categories
    await createNotificationChannels().catch(() => null);
    await registerNotificationCategories().catch(() => null);

    // Register background task for silent (data-only) pushes
    await registerBackgroundNotificationTask().catch(() => null);

    // Get native FCM token
    let token: string | undefined;
    try {
      const result = await Notifications.getDevicePushTokenAsync();
      token = result.data as string;
    } catch (err) {
      console.warn('[push] getDevicePushTokenAsync failed — FCM push will not work on this device:', err);
      return;
    }

    if (!token) return;
    registeredTokenRef.current = token;

    await registerDevice({
      token,
      deviceId:   deviceIdRef.current,
      platform:   getPlatform(),
      deviceName: getDeviceName(),
    }).unwrap().catch((err) =>
      console.error('[push] registerDevice failed:', err),
    );
  }, [registerDevice]);

  const unregisterDevice = useCallback(async () => {
    if (!registeredTokenRef.current) return;
    await removeDevice({ deviceId: deviceIdRef.current }).unwrap().catch(() => null);
    registeredTokenRef.current = null;
  }, [removeDevice]);

  // Register/unregister on auth state change
  useEffect(() => {
    if (isAuthenticated) {
      requestPermissionsAndRegister();
    } else {
      unregisterDevice();
    }
  }, [isAuthenticated, requestPermissionsAndRegister, unregisterDevice]);

  // Killed-app launch: check for the notification that opened the app
  useEffect(() => {
    if (!isAuthenticated) return;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    }).catch(() => null);
  }, [isAuthenticated, handleNotificationResponse]);

  // Foreground notification received
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.info('[push] Foreground notification:', notification.request.content.title);
      // Badge is managed by shouldSetBadge: true in the global handler
    });

    // User tapped a notification or an action button
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      if (actionId === DEFAULT_ACTION_IDENTIFIER || actionId === 'open') {
        handleNotificationResponse(response);
      } else if (actionId === 'approve' || actionId === 'reject') {
        // For approval action buttons: navigate to the detail screen
        // where the user can confirm the action in-app
        handleNotificationResponse(response);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleNotificationResponse]);

  // Token refresh — FCM rotates tokens; re-register automatically.
  // Guard: skip if the incoming token equals the one already registered this session.
  // Without this check, getDevicePushTokenAsync() (Path A) and addPushTokenListener
  // (Path B) both fire on first launch with the same token, producing a duplicate POST.
  useEffect(() => {
    const sub = Notifications.addPushTokenListener((pushToken) => {
      if (!isAuthenticated || !pushToken.data) return;
      const newToken = pushToken.data as string;
      if (newToken === registeredTokenRef.current) return;
      registeredTokenRef.current = newToken;
      registerDevice({
        token:      newToken,
        deviceId:   deviceIdRef.current,
        platform:   getPlatform(),
        deviceName: getDeviceName(),
      }).catch((err) => console.error('[push] Token refresh registration failed:', err));
    });
    return () => sub.remove();
  }, [isAuthenticated, registerDevice]);
}
