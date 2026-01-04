import * as adobeSession from './adobe_utils/SessionManager'
import { Request, Response } from 'express'
import { auth, firestore } from 'firebase-admin'
import axios from 'axios'
import crypto from 'crypto'
import qs from 'querystring'
import { db } from './server'

interface TokenResponse {
  access_token: string,
  refresh_token: string,
  sub: string,
  id_token: string,
  token_type: string,
  expires_in: number
};

interface UserResponse {
  sub: string,
  account_type: string,
  email_verified: boolean,
  address: {
    country: string
  },
  name: string,
  given_name: string,
  family_name: string,
  email: string,
}

const secrets = JSON.parse(process.env.SECRETS as string);

export async function decodeToken(req: Request, res: Response, auth: auth.Auth) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ isAuthenticated: false, message: 'No authentication token provided.' });
    return false;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    await auth.verifyIdToken(idToken);
    return true;
  } catch (err) {
    res.status(401).json({ isAuthenticated: false, message: 'Invalid or expired authentication token.' });
    return false;
  }
}

export const adobe_token = async (req: Request, res: Response) => {
    if (req.session.auth == 0) return 'error';
    const token = await adobeSession.apiToken();
    return token;
}

export const authenticate = (req: Request, res: Response) => {
    const authUrl = 'https://ims-na1.adobelogin.com/ims/authorize/v2?';
    const state = crypto.randomBytes(16).toString('hex');
    req.session.state = state;

    const params = qs.stringify({
        client_id: secrets.adobe_id,
        redirect_uri: process.env.REDIRECT,
        response_type: 'code',
        scope: 'lr_partner_apis,offline_access,AdobeID,openid,lr_partner_rendition_apis',
        state: state
    });
    req.session.save();
    res.redirect(`${authUrl}${params}`);
}

export const get_auth = async (req: Request, res: Response, auth: auth.Auth) => {
    const auth_token = await decodeToken(req, res, auth);

    if (auth_token) {
        res.status(200).json({
        isAuthenticated: true,
        message: 'User is authenticated.'
        });
    }
}

export const callback = async (req: Request, res: Response, auth: auth.Auth) => {
    const { code, state, error } = req.query;

    if (error) {
        res.send(`Adobe Sign-In Error: ${error}`);
        return;
    }

    if (!code) {
        res.send('Authorization code not found.');
        return;
    }

    try {
      const tokenUrl = 'https://ims-na1.adobelogin.com/ims/token/v3';
      const authString = Buffer.from(`${secrets.adobe_id}:${secrets.adobe_secret}`).toString('base64');
      const params = qs.stringify({
      code: code as string,
      grant_type: 'authorization_code',
      client_id: secrets.adobe_id,
      client_secret: secrets.adobe_secret
      });
      
      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
            'Authorization': authString,
            'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      const accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;
      const expiryTime = response.data.expires_in;
      
      const userUrl = `https://ims-na1.adobelogin.com/ims/userinfo/v2?client_id=${secrets.adobe_id}`;
      const userInfo = await axios.get<UserResponse>(userUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
      });

      const userId = userInfo.data.sub;

      if (userId != secrets.admin_id) {
        const revokeUrl = 'https://ims-na1.adobelogin.com/ims/revoke';
        await axios.post(revokeUrl, `token=${accessToken}`, {
            headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authString}`
            }
        });

        res.status(404).send('Wrong user, please try again');
        return;
      }

      try {
        const firebaseCustomToken = await auth.createCustomToken(userId, {
            source: 'adobe_api'
        });

        console.log(`Successfully minted Firebase custom token for Adobe user`);
        await adobeSession.createSession(accessToken, refreshToken, expiryTime);
        res.redirect(`https://photo-admin-3b694.firebaseapp.com/?token=${firebaseCustomToken}`);
        // res.header({ firebaseCustomToken });
      } catch (error: any) {
        console.error('Error minting Firebase custom token:', error.message);
      }
    } catch (error: any) {
        console.error('Error getting tokens: ', error);
        res.status(404).send('Error retrieving access token');
    }
}