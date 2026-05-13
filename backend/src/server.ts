import express, { Request, Response } from 'express';
import https from 'https';
import http from 'http';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as admin from 'firebase-admin';
import * as authController from './controllers/auth.contoller';
import { fetchRenditions } from './adobe_utils/GetRenditions';
import { getAlbums } from './adobe_utils/GetAlbums';
import { getAssets } from './adobe_utils/GetAssets';
import * as adobeSession from './adobe_utils/SessionManager';
import { AddressInfo } from 'net';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from './middleware/requireAuth';
import * as collectionController from './controllers/collection.controller';
import * as albumController from './controllers/album.controller';

dotenv.config();

// interface TokenResponse {
//   access_token: string,
//   refresh_token: string,
//   sub: string,
//   id_token: string,
//   token_type: string,
//   expires_in: number
// };

// interface UserResponse {
//   sub: string,
//   account_type: string,
//   email_verified: boolean,
//   address: {
//     country: string
//   },
//   name: string,
//   given_name: string,
//   family_name: string,
//   email: string,
// }

// interface Collection {
//   name: string,
//   album: string,
//   thumbnail: string,
//   selected: boolean,
//   index: number
// }

const secrets = JSON.parse(process.env.SECRETS as string);

if (!admin.apps.length){
    if (process.env.ENV == 'dev') {
      console.log('Running on dev, starting emulators...');
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';

      console.log('Operating in dev environment');
      const serviceAccountPath = path.resolve(process.cwd(), 'src', 'serviceAccountKey.json');
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

      admin.initializeApp({
          projectId: process.env.FIREBASE_ID,
          storageBucket: process.env.FIREBASE_BUCKET,
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
      });
    } else {
      console.log('Operating in production environment');
      admin.initializeApp({
        projectId: process.env.FIREBASE_ID,
        storageBucket: process.env.FIREBASE_BUCKET,
        credential: admin.credential.applicationDefault()
      });
    }
}

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT;

const allowedOrigins = [
  'https://adobeid-na1.services.adobe.com',
  'https://auth.services.adobe.com',
  'https://photo-admin-3b694.firebaseapp.com'
];

if (process.env.ENV === 'dev') {
  allowedOrigins.push(
    'http://localhost:4000',
    'http://localhost:3000',
    'https://localhost:4000',
    'https://localhost:3000',
    'https://localhost:5000'
  );
}

app.use(cors({
  credentials: true,
  origin: allowedOrigins
}));

app.use(cookieParser(secrets.session_secret));

app.use(express.json({ limit: '50mb' }));

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

app.get('/auth', authController.authenticate);
app.get('/auth/status', authController.getStatus(admin.auth()));
app.get('/callback', async (req, res) => {
  authController.callback(req, res, admin.auth());
});

const apiRouter = express.Router();
apiRouter.use(requireAuth);

apiRouter.get('/collections', collectionController.getCollections);
apiRouter.post('/collections/:collectionId', collectionController.addCollection);
apiRouter.delete('/collections/:collectionId', collectionController.deleteCollection);
apiRouter.patch('/collections/:collectionId', collectionController.updateCollection);
apiRouter.patch('/collections/reorder', collectionController.reorderCollections);
apiRouter.patch('/collections/:collectionId/:thumbnailAsset', collectionController.updateCollectionThumbnail);

apiRouter.get('/albums/:collectionId', albumController.getAlbumsForCollection);
apiRouter.put('/albums/:albumId/:collectionId', albumController.associateAlbum);
apiRouter.get('/albums/:collectionId/photos', albumController.getPhotos);
apiRouter.get('/albums/:albumId/thumbnails', albumController.getThumbnails);
apiRouter.patch('/albums/:albumId/reorder', albumController.reorderPhotos);

apiRouter.post('/refresh', async (req, res) => {
    const token = res.locals.adobeToken;
    const albums = await getAlbums(token);
    for (let album in albums) {
      await fetchRenditions(token, album, '2048');
      await fetchRenditions(token, album, 'thumbnail2x');
    }
    res.status(200).send('Updated all Adobe assets');
});

app.use('/api', apiRouter);

export { db, admin };