import { NextFunction, Request, Response } from 'express';
import { isAdobeAuthError } from '../adobe_utils/errors';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  if (isAdobeAuthError(err)) {
    console.error('Adobe session is no longer valid:', err);
    return res.status(401).json({
      error: 'adobe/session-expired',
      message: 'The Adobe session has expired. Please sign in again.'
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).send('Internal Server Error');
};
