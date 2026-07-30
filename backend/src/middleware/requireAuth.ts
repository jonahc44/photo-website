import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import * as auth from '../controllers/auth.contoller';
import { isAdobeAuthError } from '../adobe_utils/errors';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auth.verifyBearerToken(req, admin.auth());
    if (!result.ok) {
      return res.status(401).json({
        error: result.reason === 'missing' ? 'auth/no-token' : 'auth/invalid-token',
        message: 'Your session has expired. Please sign in again.'
      });
    }

    res.locals.adobeToken = await auth.adobe_token(req, res);
    next();
  } catch (error) {
    // A dead Adobe session is an auth problem, not a server fault: the client
    // needs to be sent back to the login page rather than shown a broken page.
    if (isAdobeAuthError(error)) {
      console.error('Adobe session is no longer valid:', error);
      return res.status(401).json({
        error: 'adobe/session-expired',
        message: 'The Adobe session has expired. Please sign in again.'
      });
    }

    console.error(error);
    return res.status(500).send('Authentication error');
  }
};
