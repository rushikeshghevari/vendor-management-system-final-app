import { Schema, model, type Document, type Types } from 'mongoose';

import type { Role } from '@/constants/roles';
import { ROLES } from '@/constants/roles';

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
  // Bill — business lifecycle
  'bill_submitted',
  'bill_reviewed',
  'bill_review_pending',
  'bill_negotiation',
  'bill_rejected',
  'bill_resubmitted',
  'bill_approved',
  'bill_verified',
  // Bill — AI + Director Financial Approval (new 3-way workflow)
  'bill_ai_verified',
  'bill_financial_approval_required',
  'bill_financial_approved',
  'bill_financial_rejected',
  'bill_director_correction_required',
  'ai_high_risk_alert',
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

export const PUSH_DELIVERY_STATUSES = ['pending', 'sent', 'failed'] as const;
export type PushDeliveryStatus = (typeof PUSH_DELIVERY_STATUSES)[number];

export interface INotification extends Document {
  title: string;
  message: string;
  module: NotificationModule;
  relatedRecord: Types.ObjectId;
  sender?: Types.ObjectId;
  receiver: Types.ObjectId;
  receiverRole: Role;
  notificationType: NotificationType;
  priority: NotificationPriority;
  category: NotificationCategory;
  isRead: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  isPushSent: boolean;
  pushDeliveryStatus: PushDeliveryStatus;
  pushSentAt?: Date;
  pushFailedAt?: Date;
  pushRetryCount: number;
  clickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title:            { type: String, required: true, trim: true },
    message:          { type: String, required: true, trim: true },
    module:           { type: String, enum: NOTIFICATION_MODULES, required: true },
    relatedRecord:    { type: Schema.Types.ObjectId, required: true },
    sender:           { type: Schema.Types.ObjectId, ref: 'User' },
    receiver:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverRole:     { type: String, enum: Object.values(ROLES), required: true },
    notificationType: { type: String, enum: NOTIFICATION_TYPES, required: true },
    priority:         { type: String, enum: NOTIFICATION_PRIORITIES, default: 'medium' },
    category:         { type: String, enum: NOTIFICATION_CATEGORIES, default: 'information' },
    isRead:              { type: Boolean, default: false },
    isArchived:          { type: Boolean, default: false },
    isDeleted:           { type: Boolean, default: false },
    isPushSent:          { type: Boolean, default: false },
    pushDeliveryStatus:  { type: String, enum: PUSH_DELIVERY_STATUSES, default: 'pending' },
    pushSentAt:          { type: Date },
    pushFailedAt:        { type: Date },
    pushRetryCount:      { type: Number, default: 0 },
    clickedAt:           { type: Date },
  },
  { timestamps: true },
);

notificationSchema.index({ receiver: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ receiver: 1, isArchived: 1, createdAt: -1 });
notificationSchema.index({ receiver: 1, isDeleted: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
