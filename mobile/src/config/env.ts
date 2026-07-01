type AppEnv = 'development' | 'staging' | 'production';

function readRequired(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". Did you create a .env file from .env.example?`,
    );
  }
  return value;
}

export const env = {
  apiUrl: readRequired(process.env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL'),
  apiTimeout: Number(process.env.EXPO_PUBLIC_API_TIMEOUT ?? 15000),
  appEnv: (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as AppEnv,
} as const;

export const isDevelopment = env.appEnv === 'development';
export const isProduction = env.appEnv === 'production';
