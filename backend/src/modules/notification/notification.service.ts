import { ROLES, type Role } from '@/constants/roles';
import {
  Notification,
  type NotificationCategory,
  type NotificationModule,
  type NotificationPriority,
  type NotificationType,
} from '@/modules/notification/notification.model';
import { User } from '@/modules/user/user.model';
import { sendPushToTokens } from '@/services/push/pushNotification.service';
import type { Actor } from '@/types/actor';
import { ApiError } from '@/utils/ApiError';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';

export interface NotificationPayload {
  title: string;
  message: string;
  module: NotificationModule;
  relatedRecord: string;
  notificationType: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  sender?: string;
}

export interface Receiver {
  id: string;
  role: Role;
}

interface ReceiverWithTokens extends Receiver {
  fcmTokens?: Array<{ token: string; platform: string; isActive: boolean }>;
}

async function dispatchPush(
  receivers: ReceiverWithTokens[],
  payload: NotificationPayload,
): Promise<void> {
  const tokens: Array<{ token: string; platform: string }> = [];
  for (const r of receivers) {
    if (r.fcmTokens) {
      for (const t of r.fcmTokens) {
        if (t.isActive && t.token) tokens.push({ token: t.token, platform: t.platform });
      }
    }
  }
  if (tokens.length === 0) return;

  await sendPushToTokens(tokens, {
    title: payload.title,
    body: payload.message,
    module: payload.module,
    referenceId: payload.relatedRecord,
    priority: payload.priority ?? 'medium',
    notificationType: payload.notificationType,
  });
}

export const notificationService = {
  /** Bulk-inserts one in-app notification per receiver, then fires FCM push. */
  async notifyUsers(receivers: Receiver[], payload: NotificationPayload): Promise<void> {
    if (receivers.length === 0) return;

    // Fetch FCM tokens alongside the insert
    const userDocs = await User.find({ _id: { $in: receivers.map((r) => r.id) } })
      .select('_id role fcmTokens')
      .lean();

    const tokenMap = new Map<string, typeof userDocs[number]>();
    for (const u of userDocs) tokenMap.set(u._id.toString(), u);

    const receiversWithTokens: ReceiverWithTokens[] = receivers.map((r) => ({
      ...r,
      fcmTokens: tokenMap.get(r.id)?.fcmTokens ?? [],
    }));

    await Notification.insertMany(
      receivers.map((receiver) => ({
        ...payload,
        receiver: receiver.id,
        receiverRole: receiver.role,
        priority: payload.priority ?? 'medium',
        category: payload.category ?? 'information',
      })),
    );

    // Fire-and-forget FCM push (never block the API response)
    dispatchPush(receiversWithTokens, payload).catch((err) =>
      console.error('[push] dispatchPush error:', err),
    );
  },

  async notifyUser(receiver: Receiver, payload: NotificationPayload): Promise<void> {
    await Notification.create({
      ...payload,
      receiver: receiver.id,
      receiverRole: receiver.role,
      priority: payload.priority ?? 'medium',
      category: payload.category ?? 'information',
    });

    const userDoc = await User.findById(receiver.id).select('fcmTokens').lean();
    if (userDoc?.fcmTokens?.length) {
      dispatchPush([{ ...receiver, fcmTokens: userDoc.fcmTokens }], payload).catch((err) =>
        console.error('[push] dispatchPush error:', err),
      );
    }
  },

  /** Every active user of a role — same idiom as quotation.service.ts's Director roster lookup. */
  async findActiveUsersByRole(role: Role): Promise<Receiver[]> {
    const users = await User.find({ role, isActive: true }).select('_id role').lean();
    return users.map((user) => ({ id: user._id.toString(), role: user.role }));
  },

  /** List notifications — Super Admin sees all; others see only their own. Excludes soft-deleted. */
  async list(query: Record<string, unknown>, actor: Actor) {
    const pagination = parsePagination(query);
    const filter: Record<string, unknown> =
      actor.role === ROLES.SUPER_ADMIN
        ? { isDeleted: { $ne: true } }
        : { receiver: actor.id, isDeleted: { $ne: true } };

    if (query.module) filter.module = query.module;
    if (query.isRead !== undefined) filter.isRead = query.isRead === 'true';
    if (query.isArchived !== undefined) filter.isArchived = query.isArchived === 'true';
    if (query.priority) filter.priority = query.priority;

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Notification.countDocuments(filter),
    ]);

    return { items, meta: buildPaginationMeta(total, pagination) };
  },

  async getUnreadCount(actor: Actor) {
    const filter: Record<string, unknown> =
      actor.role === ROLES.SUPER_ADMIN
        ? { isRead: false, isDeleted: { $ne: true } }
        : { receiver: actor.id, isRead: false, isDeleted: { $ne: true } };
    const count = await Notification.countDocuments(filter);
    return { count };
  },

  async markRead(id: string, actor: Actor) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, receiver: actor.id },
      { isRead: true, clickedAt: new Date() },
      { new: true },
    );
    if (!notification) throw ApiError.notFound('Notification not found');
    return notification;
  },

  async markAllRead(actor: Actor) {
    await Notification.updateMany(
      { receiver: actor.id, isRead: false },
      { isRead: true },
    );
  },

  async archive(id: string, actor: Actor) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, receiver: actor.id },
      { isArchived: true },
      { new: true },
    );
    if (!notification) throw ApiError.notFound('Notification not found');
    return notification;
  },

  async softDelete(id: string, actor: Actor) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, receiver: actor.id },
      { isDeleted: true },
      { new: true },
    );
    if (!notification) throw ApiError.notFound('Notification not found');
    return notification;
  },

  async deleteAll(actor: Actor) {
    await Notification.updateMany({ receiver: actor.id }, { isDeleted: true });
  },

  /** Super Admin only: broadcast to all users or filtered by role/department. */
  async broadcast(
    payload: {
      title: string;
      message: string;
      targetRoles?: Role[];
      targetUserIds?: string[];
    },
    actor: Actor,
  ) {
    if (actor.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Super Admin only');

    const userFilter: Record<string, unknown> = { isActive: true };
    if (payload.targetUserIds?.length) {
      userFilter._id = { $in: payload.targetUserIds };
    } else if (payload.targetRoles?.length) {
      userFilter.role = { $in: payload.targetRoles };
    }

    const users = await User.find(userFilter).select('_id role fcmTokens').lean();

    const notificationPayload: NotificationPayload = {
      title: payload.title,
      message: payload.message,
      module: 'system',
      relatedRecord: actor.id,
      notificationType: 'broadcast',
      priority: 'high',
      category: 'information',
      sender: actor.id,
    };

    await Notification.insertMany(
      users.map((u) => ({
        ...notificationPayload,
        receiver: u._id,
        receiverRole: u.role,
      })),
    );

    const receiversWithTokens: ReceiverWithTokens[] = users.map((u) => ({
      id: u._id.toString(),
      role: u.role,
      fcmTokens: u.fcmTokens,
    }));

    dispatchPush(receiversWithTokens, notificationPayload).catch((err) =>
      console.error('[push] broadcast push error:', err),
    );

    return { sent: users.length };
  },

  async getAnalytics(actor: Actor) {
    if (actor.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Super Admin only');

    const [total, delivered, read, failed] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ isPushSent: true }),
      Notification.countDocuments({ isRead: true }),
      Notification.countDocuments({ isPushSent: false }),
    ]);

    const readPercentage = total > 0 ? Math.round((read / total) * 100) : 0;

    return { total, delivered, read, unread: total - read, failed, readPercentage };
  },
};
