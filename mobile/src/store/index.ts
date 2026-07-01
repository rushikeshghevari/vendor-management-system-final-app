import { configureStore } from '@reduxjs/toolkit';

import { baseApi } from '@/store/baseApi';
import uiReducer from '@/store/uiSlice';
import authReducer from '@/features/auth/authSlice';

export function createStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

export const store = createStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
