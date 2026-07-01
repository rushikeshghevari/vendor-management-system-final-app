import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),

  mongoUri: required('MONGODB_URI'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  // No wildcard fallback: combined with `credentials: true` in app.ts, a default of "*" would
  // reflect any origin for credentialed requests. Must be set explicitly (see .env.example).
  corsOrigin: required('CORS_ORIGIN').split(',').map((origin) => origin.trim()),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),

  seedSuperAdmin: {
    name: process.env.SEED_SUPER_ADMIN_NAME ?? 'Super Admin',
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@gmail.com',
    password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? '1',
  },
} as const;

export const isProduction = env.nodeEnv === 'production';
