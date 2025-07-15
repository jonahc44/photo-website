import express, { Request, Response } from 'express'
import https from 'https'
import http from 'http'
import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'
import qs from 'querystring'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
import session from 'express-session'
import subdomain from 'express-subdomain'
import * as admin from 'firebase-admin'
import { FirestoreStore } from '@google-cloud/connect-firestore'
import { fetchRenditions } from './adobe_utils/GetRenditions'
import { getAlbums } from './adobe_utils/GetAlbums'
import { getAssets } from './adobe_utils/GetAssets'
import * as adobeSession from './adobe_utils/SessionManager'
import { AddressInfo } from 'net';

dotenv.config();

declare module 'express-session' {
  interface SessionData {
    auth?: number,
    state?: string
  }
}

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

async function decodeToken(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ isAuthenticated: false, message: 'No authentication token provided.' });
    return false;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(idToken);
    return true;
  } catch (err) {
    res.status(401).json({ isAuthenticated: false, message: 'Invalid or expired authentication token.' });
    return false;
  }
}

if (!admin.apps.length){
    if (process.env.ENV == 'dev') {
      console.log('Operating in dev environment');
      const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, './serviceAccountKey.json'), 'utf8'));
      admin.initializeApp({
          // apiKey: process.env.FIREBASE_KEY,
          projectId: process.env.FIREBASE_ID,
          storageBucket: process.env.FIREBASE_BUCKET,
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
      });
    } else {
      admin.initializeApp();
    }
}

const db = admin.firestore();

// const bucket = admin.storage().bucket();

const app = express();
const PORT = process.env.PORT || 8080;
// const router = express.Router();

app.use(cors({
  credentials: true,
  origin: [
    'http://localhost:4000',
    'http://localhost:3000',
    'https://localhost:4000',
    'https://localhost:3000',
    'https://photo-website-backend--photo-website-f20b9.us-central1.hosted.app',
    'https://adobeid-na1.services.adobe.com',
    'https://auth.services.adobe.com'
  ]
}));

app.use(session({
  secret: secrets.session_secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, 
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'none'
  },
  store: new FirestoreStore({
    dataset: db,
    kind: 'express-session'
  })
}))

if (process.env.ENV == 'dev') {
  console.log('Operating in dev environment');
  https.createServer({
    key: fs.readFileSync(path.join(__dirname, "localhost-key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "localhost.pem")),
  }, app).listen(PORT, () => {
    console.log(`Listening securely on port ${PORT}`);
  });
} else {
  const server = app.listen(PORT, () => {
  const address = server.address() as AddressInfo;
  if (!address) return;
    console.log(`App listening on ${address.address}:${PORT}`);
  })
}

app.get('/auth', (req, res) => {
  const authUrl = 'https://ims-na1.adobelogin.com/ims/authorize/v2?';
  const state = crypto.randomBytes(16).toString('hex');
  req.session.state = state;
  // console.log(req.sessionID);

  const params = qs.stringify({
    client_id: secrets.adobe_id,
    redirect_uri: process.env.REDIRECT,
    response_type: 'code',
    scope: 'lr_partner_apis,offline_access,AdobeID,openid,lr_partner_rendition_apis',
    state: state
  });
  req.session.save();
  res.redirect(`${authUrl}${params}`);
})

app.get('/auth-status', async (req, res) => {
  const auth = await decodeToken(req, res);

  if (auth) {
    res.status(200).json({
      isAuthenticated: true,
      message: 'User is authenticated.'
    });
  }
})

// app.post('/logout', (req, res) => {
//   req.session.destroy(function(err) {
//     console.log('Destroying session');
//   });
// })

app.get('/callback', async (req, res) => {
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

      res.send('Wrong user, please try again');
      return;
    }

    try {
      const firebaseCustomToken = await admin.auth().createCustomToken(userId, {
        source: 'adobe_api'
      });

      console.log(`Successfully minted Firebase custom token for Adobe user`);
      adobeSession.createSession(accessToken, refreshToken, expiryTime, db);
      res.redirect(`https://localhost:4000/#token=${firebaseCustomToken}`);
      // res.header({ firebaseCustomToken });
    } catch (error: any) {
      console.error('Error minting Firebase custom token:', error.message);
    }
  } catch (error: any) {
    console.error('Error getting tokens: ', error.response);
    res.send('Error retrieving access token');
  }
})

app.get('/get-albums', async (req, res) => {
  const auth = await decodeToken(req, res);
  if (!auth) {
    console.log('Not authorized');
    return;
  }
  if (req.session.auth == 0) return console.error('Unauthorized user');
  const token = await adobeSession.apiToken(db);
  if (token == 'error') return console.error('No api token');

  await getAlbums(token);
  const config = fs.readFileSync(path.join(__dirname, 'photo_config.json'), 'utf-8');
  const jsonConfig = JSON.parse(config);
  
  res.json(jsonConfig.albums);
  console.log('Successfully fetched albums');
});

app.put('/album-click/:id', async (req, res) => {
  console.log('Altering selected albums...');
  const auth = await decodeToken(req, res);
  if (!auth) return;

  const key = req.params.id;
  const configPath = path.join(__dirname, 'photo_config.json');
  const config = fs.readFileSync(configPath, 'utf-8');
  const jsonConfig = JSON.parse(config); 

  if (!(key in jsonConfig.albums)) {
    res.status(400).send('Cannot add new album');
    return;
  }

  jsonConfig.albums[key].selected = !jsonConfig.albums[key].selected;
  fs.writeFileSync(configPath, JSON.stringify(jsonConfig, null, 2));
  res.json(jsonConfig.albums);

  const token = await adobeSession.apiToken(db);
  if (token == 'error') return console.error('No api token');
  await getAssets(token);
  console.log('Successfully altered albums');
});

app.get('/photos', async (req, res) => {
  if (req.session.auth == 0) return console.error('Unauthorized user');
  const token = await adobeSession.apiToken(db);
  if (token == 'error') return console.error('No api token');

  const photoUrls = await fetchRenditions(token, db);
  res.json(photoUrls);
  console.log('Successfully fetched photos');
});

// app.post('/refresh-catalog', async (req, res) => {
//   const token = await adobeSession.apiToken(db);
//   await getCatalog(token);
// })