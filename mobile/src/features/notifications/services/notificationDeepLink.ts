/**
 * Centralized deep-link resolver for push notifications.
 *
 * Maps (module, notificationType, referenceId, role) → navigation params
 * that can be passed to navigation.navigate(...).
 *
 * Only module-level routing is done here. Fine-grained screen routing
 * (e.g. which tab to land on per role) is handled by the individual detail
 * screens, so we keep this focused on "which resource detail to show."
 */

export interface DeepLinkTarget {
  rootScreen: 'NotificationCenter' | 'Main';
  /** The screen name inside the relevant stack navigator */
  screen: string;
  params: Record<string, string | undefined>;
}

export function resolveDeepLinkTarget(data: Record<string, string>): DeepLinkTarget | null {
  const { module: mod, referenceId, notificationType } = data;

  if (!mod || !referenceId) return null;

  switch (mod) {
    case 'quotation':
      return {
        rootScreen: 'Main',
        screen: 'QuotationDetails',
        params: { quotationId: referenceId },
      };

    case 'bill':
      return {
        rootScreen: 'Main',
        screen: 'BillDetails',
        params: { billId: referenceId },
      };

    case 'payment':
      return {
        rootScreen: 'Main',
        screen: 'PaymentDetails',
        params: { paymentId: referenceId },
      };

    case 'purchase_order':
      return {
        rootScreen: 'Main',
        screen: 'PurchaseOrderDetails',
        params: { purchaseOrderId: referenceId },
      };

    case 'vendor':
      return {
        rootScreen: 'Main',
        screen: 'VendorDetails',
        params: { vendorId: referenceId },
      };

    case 'system':
      // System announcements / broadcasts → go to the notification list
      return {
        rootScreen: 'NotificationCenter',
        screen: 'NotificationList',
        params: {},
      };

    default:
      return null;
  }
}

/** Extract the notification data payload from an expo-notifications response */
export function getNotificationData(
  response: import('expo-notifications').NotificationResponse,
): Record<string, string> {
  const raw = response.notification.request.content.data ?? {};
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, String(v ?? '')]),
  );
}

/** The action identifier sent by expo-notifications for the default tap (no action button) */
export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';
