import express from 'express'
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
import sqlite from 'connect-sqlite3'
// import { initializeApp } from 'firebase/app'
import * as admin from 'firebase-admin'
// import serviceAccount from './serviceAccountKey.json'
// import { getAnalytics } from "firebase/analytics"
// import { Storage } from '@google-cloud/storage'
import { getRenditions } from './adobe_utils/GetRenditions'
import * as adobeSession from './adobe_utils/SessionManager'
import { AddressInfo } from 'net';

dotenv.config();
const sqliteConstructor = sqlite(session);

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
      admin.initializeApp({});
    }
}

// const bucket = admin.storage().bucket();

const app = express();
const PORT = process.env.PORT || 8080;
// const router = express.Router();

app.use(session({
  secret: secrets.session_secret || '',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  store: new sqliteConstructor({
    db: 'sessions.db',
    table: 'sessions'
  }) as session.Store
}))
// app.use(passport.initialize());
// app.use(passport.session());
app.use(cors({
  credentials: true,
  origin: [
    'http://localhost:4000',
    'http://localhost:3000'
  ]
}));
// app.use(express.json());
// app.use(subdomain('api', router));

// if (process.env.ENV == 'dev') {
//   console.log('Operating in dev environment');
//   https.createServer({
//     key: fs.readFileSync(path.join(__dirname, "localhost-key.pem")),
//     cert: fs.readFileSync(path.join(__dirname, "localhost.pem")),
//   }, app);
// }

const server = app.listen(PORT, () => {
  const address = server.address() as AddressInfo;
  if (!address) return;
  console.log(`App listening on ${address.address}:${PORT}`);
})

// app.use('/photos', express.static(path.join(__dirname, 'public/photos').replace('dist', 'src'), {
//   setHeaders: function(res, path) {
//     res.set("Content-Security-Policy", "default-srd 'self'")
//   }
// }));

app.get('/auth', (req, res) => {
  const authUrl = 'https://ims-na1.adobelogin.com/ims/authorize/v2?';
  const state = crypto.randomBytes(16).toString('hex');
  req.session.state = state;
  console.log(req.sessionID);

  const params = qs.stringify({
    client_id: secrets.adobe_id,
    redirect_uri: process.env.REDIRECT,
    response_type: 'code',
    scope: 'lr_partner_apis,offline_access,AdobeID,openid,lr_partner_rendition_apis',
    state: state
  });
  req.session.save;
  res.redirect(`${authUrl}${params}`);
})

app.get('/auth-status', (req, res) => {
  if (!req.session.auth) {
    res.send(0);
    return;
  }

  res.send(req.session.auth);
})

app.post('/logout', (req, res) => {
  req.session.destroy;
})

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
    
    console.log(req.sessionID);

    if (state != req.session.state) {
      res.send('Error, different session');
      console.error(state, ' vs ', req.session.state);
      return;
    }

    adobeSession.createSession(accessToken, refreshToken, expiryTime)    
    req.session.auth = 1;
    req.session.save;
    res.redirect('http://localhost:4000/');
  } catch (error: any) {
    console.error('Error getting tokens: ', error.response);
    res.send('Error retrieving access token');
  }
})

// app.get('/get-albums', async (req, res) => {
//   if (req.session.auth == 0) return console.error('Unautorized user');
//   const token = await adobeSession.apiToken();
//   if (token == 'error') return console.error('No api token');
//   const config = fs.readFileSync(path.join(__dirname, 'photo_config.json'), 'utf-8');
//   const jsonConfig = JSON.parse(config);
  
//   res.json(jsonConfig.albums);
// });

// app.put('/album-click/:id', async (req, res) => {
//   const key = req.params.id;
//   const configPath = path.join(__dirname, 'photo_config.json');
//   const config = fs.readFileSync(configPath, 'utf-8');
//   const jsonConfig = JSON.parse(config); 

//   if (!(key in jsonConfig.albums)) {
//     res.status(400).send('Cannot add new album');
//     return;
//   }

//   jsonConfig.albums[key].selected = !jsonConfig.albums[key].selected;
//   fs.writeFileSync(configPath, JSON.stringify(jsonConfig, null, 2));
//   res.json(jsonConfig.albums);
// });

// app.use('/photos', express.static(path.join(__dirname, 'public/photos').replace('dist', 'src'), {
//   setHeaders: function(res, path) {
//     res.set("Content-Security-Policy", "default-srd 'self'")
//   }
// }));

app.get('/photos', async (req, res) => {
  if (req.session.auth == 0) return console.error('Unautorized user');
  const token = await adobeSession.apiToken();
  if (token == 'error') return console.error('No api token');
  // await getAssets(token);
  
  // const photos = await getRenditions(token);
  // const photoJson = JSON.stringify(photos);

  // const folderPath = path.join(__dirname, 'public/photos').replace('dist', 'src');

  // fs.readdir(folderPath, (err, files) => {
  //   if (err) {
  //     console.log(err.message);
  //     return res.status(500).json({ error: 'Unable to scan directory' });
  //   }

  //   const photoUrls = files.map(file => `${req.protocol}://${req.get('host')}/photos/${file}`);
  //   res.json(photoUrls);
  // });
  const photoUrls = await getRenditions(token);
  res.json(photoUrls);
});

// process.on('SIGINT', () => {
//   const sessions = path.join(__dirname, '../sessions.db');
//   const tokens = path.join(__dirname, '../tokens.db');
//   fs.unlink(sessions, (err) => {
//     console.log('Error deleting file: ', err);
//   });
//   fs.unlink(tokens, (err) => {
//     console.log('Error: ', err);
//   });
// })