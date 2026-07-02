type AppEnv = 'development' | 'staging' | 'production';

// EXPO_PUBLIC_* vars are inlined by Metro at build time from .env.
// If the build ran without a .env (e.g. EAS without env secrets configured),
// the value is undefined and the app must not crash — it will show API errors
// instead, which is the correct UX for a misconfigured build.
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  apiTimeout: Number(process.env.EXPO_PUBLIC_API_TIMEOUT ?? 15000),
  appEnv: (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as AppEnv,
} as const;

export const isDevelopment = env.appEnv === 'development';
export const isProduction = env.appEnv === 'production';
