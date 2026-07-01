import type { PropsWithChildren, ReactNode } from 'react';

import type { Role } from '@/constants/roles';
import { useAuth } from '@/hooks/useAuth';

interface RoleGateProps extends PropsWithChildren {
  allow: Role[];
  fallback?: ReactNode;
}

/** Renders children only when the current user's role is in `allow`. */
export function RoleGate({ allow, fallback = null, children }: RoleGateProps) {
  const { hasRole } = useAuth();
  return hasRole(...allow) ? children : fallback;
}
