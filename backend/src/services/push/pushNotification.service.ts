import { firebaseService } from '@/services/firebase/firebase.service';

export interface PushPayload {
  title: string;
  body: string;
  module?: string;
  referenceId?: string;
  screen?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  notificationType?: string;
}

interface TokenEntry {
  token: string;
  platform: string;
}

/**
 * Send FCM push notifications to a list of device tokens.
 * Silently skips if Firebase is not configured (env vars absent).
 * Returns count of successfully sent messages.
 */
export async function sendPushToTokens(
  tokens: TokenEntry[],
  payload: PushPayload,
): Promise<number> {
  const messaging = firebaseService.getMessaging();
  if (!messaging || tokens.length === 0) return 0;

  const activeTokens = tokens.filter((t) => t.token && t.token.length > 0);
  if (activeTokens.length === 0) return 0;

  const androidPriority = payload.priority === 'critical' || payload.priority === 'high'
    ? 'high'
    : 'normal';

  const messages = activeTokens.map((t) => ({
    token: t.token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      module:           payload.module ?? '',
      referenceId:      payload.referenceId ?? '',
      screen:           payload.screen ?? '',
      priority:         payload.priority ?? 'medium',
      notificationType: payload.notificationType ?? '',
    },
    android: {
      priority: androidPriority as 'high' | 'normal',
      notification: {
        channelId: 'vms_default',
        priority: androidPriority === 'high' ? 'max' as const : 'default' as const,
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: 'default',
          badge: 1,
        },
      },
    },
  }));

  try {
    const batch = await messaging.sendEach(messages);
    const successCount = batch.responses.filter((r) => r.success).length;
    if (batch.failureCount > 0) {
      console.warn(`[push] ${batch.failureCount} FCM messages failed out of ${messages.length}`);
    }
    return successCount;
  } catch (err) {
    console.error('[push] FCM sendEach error:', err);
    return 0;
  }
}

/**
 * Send a FCM push to a single device token.
 */
export async function sendPushToToken(token: string, payload: PushPayload): Promise<boolean> {
  const result = await sendPushToTokens([{ token, platform: 'android' }], payload);
  return result > 0;
}
