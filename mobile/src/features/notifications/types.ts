export const NOTIFICATION_MODULES = ['quotation', 'bill'] as const;
export type NotificationModule = (typeof NOTIFICATION_MODULES)[number];

export const NOTIFICATION_TYPES = [
  'quotation_submitted',
  'quotation_reviewed',
  'review_pending',
  'quotation_negotiation',
  'quotation_rejected',
  'quotation_resubmitted',
  'quotation_approved',
  'bill_submitted',
  'bill_verified',
  'payment_pending',
  'payment_paid',
  'payment_completed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  title: string;
  message: string;
  module: NotificationModule;
  relatedRecordId: string;
  notificationType: NotificationType;
  isRead: boolean;
  createdAt: string;
}
