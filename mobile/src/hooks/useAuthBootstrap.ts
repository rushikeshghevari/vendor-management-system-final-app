import { useEffect } from 'react';

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
        await secureStorage.clearTokens();
        dispatch(sessionRestored(null));
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
      }),
    [dispatch],
  );
}
