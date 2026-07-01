import { baseApi } from '@/store/baseApi';
import type { Notification, NotificationModule, NotificationType } from '@/features/notifications/types';

interface RawNotification {
  _id: string;
  title: string;
  message: string;
  module: NotificationModule;
  relatedRecord: string;
  notificationType: NotificationType;
  isRead: boolean;
  createdAt: string;
}

function toNotification(raw: RawNotification): Notification {
  return {
    id: raw._id,
    title: raw.title,
    message: raw.message,
    module: raw.module,
    relatedRecordId: raw.relatedRecord,
    notificationType: raw.notificationType,
    isRead: raw.isRead,
    createdAt: raw.createdAt,
  };
}

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<Notification[], void>({
      query: () => ({ url: '/notifications', method: 'GET', params: { limit: 100 } }),
      transformResponse: (raw: RawNotification[]) => raw.map(toNotification),
      providesTags: (result) => [
        ...(result ?? []).map((item) => ({ type: 'Notification' as const, id: item.id })),
        { type: 'Notification' as const, id: 'LIST' },
      ],
    }),

    getUnreadNotificationCount: builder.query<number, void>({
      query: () => ({ url: '/notifications/unread-count', method: 'GET' }),
      transformResponse: (raw: { count: number }) => raw.count,
      providesTags: [{ type: 'Notification', id: 'UNREAD_COUNT' }],
    }),

    markNotificationRead: builder.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Notification', id },
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'UNREAD_COUNT' },
      ],
    }),

    markAllNotificationsRead: builder.mutation<void, void>({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: [
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'UNREAD_COUNT' },
      ],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery: useGetUnreadNotificationCountQueryBase,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;

// Polled rather than pushed — the backend has no realtime/socket layer, so this is the one
// query in the app with a `pollingInterval`, kept deliberately infrequent. Every screen that
// shows the bell badge or "Unread Notifications" task count should use this, not the raw
// generated hook, so the polling cadence stays consistent everywhere.
export function useGetUnreadNotificationCountQuery() {
  return useGetUnreadNotificationCountQueryBase(undefined, { pollingInterval: 30000 });
}
