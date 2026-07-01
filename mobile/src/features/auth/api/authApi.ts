import { baseApi } from '@/store/baseApi';
import { secureStorage } from '@/utils/secureStorage';
import { setCredentials, loggedOut } from '@/features/auth/authSlice';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        data: credentials,
      }),
      onQueryStarted: async (_arg, { queryFulfilled, dispatch }) => {
        try {
          const { data } = await queryFulfilled;
          await secureStorage.setTokens(data.accessToken, data.refreshToken);
          dispatch(setCredentials(data.user));
          // Wipe any RTK Query cache left over from a previous session on this device
          // (e.g. a Super Admin's unscoped Vendor list) — without this, a different
          // user logging in on the same app instance could briefly see stale,
          // wrongly-scoped cached data before the next refetch.
          dispatch(baseApi.util.resetApiState());
        } catch {
          // Invalid credentials / validation error — surfaced via the mutation's
          // `error` state in the component; nothing to clean up here.
        }
      },
      invalidatesTags: ['Auth', 'User'],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      onQueryStarted: async (_arg, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
        } catch {
          // Server logout failed or is unreachable — still clear the local session below.
        } finally {
          await secureStorage.clearTokens();
          dispatch(loggedOut());
          dispatch(baseApi.util.resetApiState());
        }
      },
    }),
    getProfile: builder.query<User, void>({
      query: () => ({ url: '/auth/me', method: 'GET' }),
      providesTags: ['User'],
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useGetProfileQuery } = authApi;
