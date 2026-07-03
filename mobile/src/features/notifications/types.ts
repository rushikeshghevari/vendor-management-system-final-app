export const NOTIFICATION_MODULES = ['quotation', 'bill', 'payment', 'purchase_order', 'vendor', 'system'] as const;
export type NotificationModule = (typeof NOTIFICATION_MODULES)[number];

export const NOTIFICATION_TYPES = [
  // Quotation
  'quotation_submitted',
  'quotation_reviewed',
  'review_pending',
  'quotation_negotiation',
  'quotation_rejected',
  'quotation_resubmitted',
  'quotation_approved',
  // Bill
  'bill_submitted',
  'bill_reviewed',
  'bill_review_pending',
  'bill_negotiation',
  'bill_rejected',
  'bill_resubmitted',
  'bill_approved',
  'bill_verified',
  // Payment
  'payment_pending',
  'payment_created',
  'payment_processing',
  'payment_paid',
  'payment_completed',
  'payment_failed',
  // Purchase Order
  'po_generated',
  'po_bill_uploaded',
  'po_ai_verified',
  'po_accounts_verified',
  'po_closed',
  // Vendor
  'vendor_created',
  'vendor_updated',
  'vendor_inactive',
  // AI
  'ai_verification_started',
  'ai_verification_completed',
  // System / Broadcast / Escalation
  'system_announcement',
  'broadcast',
  'escalation',
  'reminder',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_CATEGORIES = ['information', 'success', 'warning', 'error'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface Notification {
  id: string;
  title: string;
  message: string;
  module: NotificationModule;
  relatedRecordId: string;
  notificationType: NotificationType;
  priority: NotificationPriority;
  category: NotificationCategory;
  isRead: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: string;
  clickedAt?: string;
}

export interface NotificationAnalytics {
  total: number;
  delivered: number;
  read: number;
  unread: number;
  failed: number;
  readPercentage: number;
}

export interface DeviceInfo {
  token: string;
  deviceId: string;
  platform: 'android' | 'ios' | 'web';
  deviceName?: string;
  createdAt: string;
  lastUsed: string;
  isActive: boolean;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}
