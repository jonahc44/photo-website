import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import * as auth from '../controllers/auth.contoller';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auth.verifyBearerToken(req, admin.auth());
    if (!result.ok) {
      return res.status(401).send('Not authorized');
    }

    const adobeToken = await auth.adobe_token(req, res);
    if (adobeToken === 'error') {
       return res.status(401).send('No API token');
    }

    res.locals.adobeToken = adobeToken; 
    next();
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication error');
  }
};