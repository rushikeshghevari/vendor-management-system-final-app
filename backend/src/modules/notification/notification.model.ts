import { Schema, model, type Document, type Types } from 'mongoose';

import type { Role } from '@/constants/roles';
import { ROLES } from '@/constants/roles';

export const NOTIFICATION_MODULES = ['quotation', 'bill', 'payment', 'purchase_order'] as const;
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
  'bill_reviewed',
  'bill_review_pending',
  'bill_negotiation',
  'bill_rejected',
  'bill_resubmitted',
  'bill_approved',
  'bill_verified',
  'payment_pending',
  'payment_created',
  'payment_processing',
  'payment_paid',
  'payment_completed',
  'payment_failed',
  'po_generated',
  'po_bill_uploaded',
  'po_ai_verified',
  'po_accounts_verified',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  title: string;
  message: string;
  module: NotificationModule;
  relatedRecord: Types.ObjectId;
  sender?: Types.ObjectId;
  receiver: Types.ObjectId;
  receiverRole: Role;
  notificationType: NotificationType;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    module: { type: String, enum: NOTIFICATION_MODULES, required: true },
    relatedRecord: { type: Schema.Types.ObjectId, required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverRole: { type: String, enum: Object.values(ROLES), required: true },
    notificationType: { type: String, enum: NOTIFICATION_TYPES, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ receiver: 1, isRead: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
