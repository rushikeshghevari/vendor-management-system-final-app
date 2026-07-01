import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { User } from '@/modules/user/user.model';
import { ApiError } from '@/utils/ApiError';
import { catchAsync } from '@/utils/catchAsync';
import { verifyAccessToken } from '@/utils/jwt';

export const authenticate = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }

  const user = await User.findById(payload.sub).select('_id role department isActive');

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  req.user = {
    id: user.id,
    role: user.role,
    department: user.department?.toString(),
  };

  next();
});
