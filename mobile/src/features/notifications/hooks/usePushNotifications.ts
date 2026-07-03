/**
 * Handles FCM device token registration and incoming notification routing.
 *
 * Usage: Mount <PushNotificationProvider> (which calls this hook) once inside
 * the authenticated navigator so tokens are registered on every login and cleaned
 * up on logout.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';

import { useRegisterDeviceMutation, useRemoveDeviceMutation } from '@/features/notifications/api/notificationsApi';
import { useAuth } from '@/hooks/useAuth';

// Global handler: show alert banner when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

function getDeviceId(): string {
  // expo-device provides a stable UUID per install
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

export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const [registerDevice] = useRegisterDeviceMutation();
  const [removeDevice]   = useRemoveDeviceMutation();

  const notificationListener = useRef<Subscription | null>(null);
  const responseListener     = useRef<Subscription | null>(null);
  const registeredTokenRef   = useRef<string | null>(null);
  const deviceIdRef          = useRef<string>(getDeviceId());

  const requestPermissionsAndRegister = useCallback(async () => {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.info('[push] Skipping FCM registration — not a physical device');
      return;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.info('[push] Push notification permission not granted');
      return;
    }

    // Create Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('vms_default', {
        name: 'VMS Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Get the native FCM / APNs token
    let token: string | undefined;
    try {
      const result = await Notifications.getDevicePushTokenAsync();
      token = result.data;
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
    await removeDevice({ deviceId: deviceIdRef.current }).unwrap().catch(() => {
      // Best-effort — if the server is unreachable the token expires naturally
    });
    registeredTokenRef.current = null;
  }, [removeDevice]);

  useEffect(() => {
    if (isAuthenticated) {
      requestPermissionsAndRegister();
    } else {
      unregisterDevice();
    }
  }, [isAuthenticated, requestPermissionsAndRegister, unregisterDevice]);

  useEffect(() => {
    // Handle foreground notifications (show in-app banner via setNotificationHandler above)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.info('[push] Foreground notification received:', notification.request.content.title);
    });

    // Handle tap on notification (background or killed-app launch)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.info('[push] Notification tapped:', response.notification.request.content.data);
      // Deep-link handling is done in the individual notification detail screen
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Token refresh — FCM rotates tokens; register the new one
  useEffect(() => {
    const sub = Notifications.addPushTokenListener((token) => {
      if (isAuthenticated && token.data) {
        registeredTokenRef.current = token.data;
        registerDevice({
          token:      token.data,
          deviceId:   deviceIdRef.current,
          platform:   getPlatform(),
          deviceName: getDeviceName(),
        }).catch((err) => console.error('[push] token refresh registration failed:', err));
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, registerDevice]);
}
