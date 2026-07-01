import { ROLES, type Role } from '@/constants/roles';
import { Notification, type NotificationModule, type NotificationType } from '@/modules/notification/notification.model';
import { User } from '@/modules/user/user.model';
import type { Actor } from '@/types/actor';
import { ApiError } from '@/utils/ApiError';
import { buildPaginationMeta, parsePagination } from '@/utils/pagination';

interface NotificationPayload {
  title: string;
  message: string;
  module: NotificationModule;
  relatedRecord: string;
  notificationType: NotificationType;
  sender?: string;
}

interface Receiver {
  id: string;
  role: Role;
}

export const notificationService = {
  /** Bulk-inserts one independent document per receiver — e.g. "notify all active Directors" never collapses into a single shared/read-by-array record. */
  async notifyUsers(receivers: Receiver[], payload: NotificationPayload) {
    if (receivers.length === 0) return;
    await Notification.insertMany(
      receivers.map((receiver) => ({
        ...payload,
        receiver: receiver.id,
        receiverRole: receiver.role,
      })),
    );
  },

  async notifyUser(receiver: Receiver, payload: NotificationPayload) {
    await Notification.create({ ...payload, receiver: receiver.id, receiverRole: receiver.role });
  },

  /** Every active user of a role — same idiom as quotation.service.ts's Director roster lookup. */
  async findActiveUsersByRole(role: Role): Promise<Receiver[]> {
    const users = await User.find({ role, isActive: true }).select('_id role').lean();
    return users.map((user) => ({ id: user._id.toString(), role: user.role }));
  },

  /** Super Admin sees every notification in the system (read-only); every other role sees only their own. */
  async list(query: Record<string, unknown>, actor: Actor) {
    const pagination = parsePagination(query);
    const filter: Record<string, unknown> = actor.role === ROLES.SUPER_ADMIN ? {} : { receiver: actor.id };

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
      actor.role === ROLES.SUPER_ADMIN ? { isRead: false } : { receiver: actor.id, isRead: false };
    const count = await Notification.countDocuments(filter);
    return { count };
  },

  /** Always own-only — even Super Admin's view is read-only, never able to mark another user's notification read. */
  async markRead(id: string, actor: Actor) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, receiver: actor.id },
      { isRead: true },
      { new: true },
    );
    if (!notification) throw ApiError.notFound('Notification not found');
    return notification;
  },

  async markAllRead(actor: Actor) {
    await Notification.updateMany({ receiver: actor.id, isRead: false }, { isRead: true });
  },
};
