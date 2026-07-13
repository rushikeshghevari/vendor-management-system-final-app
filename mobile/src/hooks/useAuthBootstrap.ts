import { useEffect } from 'react';
import { Alert } from 'react-native';

import { authApi } from '@/features/auth/api/authApi';
import { loggedOut, sessionRestored } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { baseApi } from '@/store/baseApi';
import { authEvents } from '@/utils/authEvents';
import { secureStorage } from '@/utils/secureStorage';

/** Restores the session from a stored token on app launch and reacts to forced logouts. */
export function useAuthBootstrap(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    (async () => {
      const accessToken = await secureStorage.getAccessToken();

      if (!accessToken) {
        dispatch(sessionRestored(null));
        return;
      }

      try {
        const user = await dispatch(authApi.endpoints.getProfile.initiate()).unwrap();
        dispatch(sessionRestored(user));
      } catch {
        // A stored token existed but couldn't be restored — the silent refresh in
        // apiClient.ts already tried and failed (expired/revoked refresh token), so this
        // is a genuine "your session ended" case, not a first-launch/never-logged-in one.
        await secureStorage.clearTokens();
        dispatch(sessionRestored(null));
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
      }
    })();
  }, [dispatch]);

  useEffect(
    () =>
      authEvents.on('unauthorized', () => {
        dispatch(loggedOut());
        // Same cache wipe as an explicit logout — a refresh-token failure ends the
        // session just as definitively, and must not leave the previous user's
        // cached (and possibly unscoped) data sitting around for whoever logs in next.
        dispatch(baseApi.util.resetApiState());
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
      }),
    [dispatch],
  );
}
