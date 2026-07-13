/**
 * Centralized deep-link resolver for push notifications.
 *
 * Maps (module, notificationType, referenceId) → navigation params
 * that can be passed to navigation.navigate(...).
 *
 * Only module-level routing is done here. Fine-grained screen routing
 * (e.g. which tab to land on per role) is handled by the individual detail
 * screens, so we keep this focused on "which resource detail to show."
 */

export interface DeepLinkTarget {
  rootScreen: 'NotificationCenter' | 'Main' | 'QuotationApproval' | 'BillFinancialApproval';
  /** The screen name inside the relevant stack navigator (unused for root-level screens) */
  screen?: string;
  params: Record<string, string | undefined>;
}

/** Notification types that open QuotationApprovalScreen directly (bypass NotificationDetails). */
const QUOTATION_APPROVAL_TYPES = new Set([
  'quotation_submitted',
  'quotation_resubmitted',
  'review_pending',
]);

/** Notification types that open BillFinancialApprovalScreen directly (bypass NotificationDetails). */
const BILL_FINANCIAL_APPROVAL_TYPES = new Set([
  'bill_financial_approval_required',
  'bill_ai_verified',
]);

export function resolveDeepLinkTarget(data: Record<string, string>): DeepLinkTarget | null {
  const { module: mod, referenceId, notificationType } = data;

  if (!mod || !referenceId) return null;

  switch (mod) {
    case 'quotation':
      // Submitted / resubmitted notifications go straight to the Approval screen so a
      // Director or CEO can act in one tap without passing through Notification Details.
      // All other quotation notifications (approved, rejected, etc.) go to the list.
      if (notificationType && QUOTATION_APPROVAL_TYPES.has(notificationType)) {
        return {
          rootScreen: 'QuotationApproval',
          params: { quotationId: referenceId, notificationId: data.notificationId },
        };
      }
      return {
        rootScreen: 'Main',
        screen: 'QuotationDetails',
        params: { quotationId: referenceId },
      };

    case 'bill':
      // Director Financial Approval notifications open the approval screen directly.
      if (notificationType && BILL_FINANCIAL_APPROVAL_TYPES.has(notificationType)) {
        return {
          rootScreen: 'BillFinancialApproval',
          params: { billId: referenceId, notificationId: data.notificationId },
        };
      }
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
        params: {},
      };

    default:
      return null;
  }
}

export interface InAppTarget {
  /** Tab name inside the `Main` tab navigator (see MainTabParamList / role-specific tab lists). */
  tab: string;
  /** Screen name inside that tab's own stack navigator. */
  screen: string;
  params: Record<string, unknown>;
}

/**
 * Role-aware "Open Related Record" target for the in-app Notification Details sheet —
 * distinct from resolveDeepLinkTarget() above, which drives push-tap routing and doesn't
 * need to pick a role-specific tab (it defers to the Notification list instead). This is the
 * single implementation for that role branching, previously duplicated inside
 * NotificationDetailsScreen.tsx.
 */
export function resolveInAppTarget(
  module: string,
  relatedRecordId: string,
  role: string,
): InAppTarget | null {
  switch (module) {
    case 'quotation':
      if (role === 'director' || role === 'ceo') {
        return { tab: 'PendingQuotations', screen: 'QuotationDetails', params: { quotationId: relatedRecordId } };
      }
      return { tab: 'Quotations', screen: 'QuotationDetails', params: { quotationId: relatedRecordId } };

    case 'bill':
      if (role === 'accounts') return { tab: 'Bills', screen: 'AccountsBillDetails', params: { billId: relatedRecordId } };
      if (role === 'director' || role === 'ceo') {
        return { tab: 'PendingBillApprovals', screen: 'BillDetails', params: { billId: relatedRecordId } };
      }
      return { tab: 'Bills', screen: 'BillDetails', params: { billId: relatedRecordId } };

    case 'purchase_order':
      return { tab: 'PurchaseOrders', screen: 'PurchaseOrderDetails', params: { purchaseOrderId: relatedRecordId } };

    case 'payment':
      return { tab: 'Payments', screen: 'PaymentDetails', params: { paymentId: relatedRecordId } };

    case 'vendor':
      return { tab: 'Vendors', screen: 'VendorDetails', params: { vendorId: relatedRecordId } };

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
