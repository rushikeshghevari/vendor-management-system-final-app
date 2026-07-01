import type { NextFunction, Request, Response } from 'express';

import type { Role } from '@/constants/roles';
import { ApiError } from '@/utils/ApiError';

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }

    next();
  };
}
