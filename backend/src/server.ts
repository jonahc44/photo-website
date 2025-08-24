import express, { Request, Response } from 'express'
import https from 'https'
import http from 'http'
import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
import session from 'express-session'
import subdomain from 'express-subdomain'
import * as admin from 'firebase-admin'
import { FirestoreStore } from '@google-cloud/connect-firestore'
import * as auth from './auth'
import { fetchRenditions } from './adobe_utils/GetRenditions'
import { getAlbums } from './adobe_utils/GetAlbums'
import { getAssets } from './adobe_utils/GetAssets'
import * as adobeSession from './adobe_utils/SessionManager'
import { AddressInfo } from 'net';
import { FieldValue } from 'firebase-admin/firestore';

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

interface Collection {
  name: string,
  album: string,
  thumbnail: string,
  selected: boolean,
  index: number
}

const secrets = JSON.parse(process.env.SECRETS as string);

if (!admin.apps.length){
    if (process.env.ENV == 'dev') {
      console.log('Operating in dev environment');
      const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, './serviceAccountKey.json'), 'utf8'));
      admin.initializeApp({
          projectId: process.env.FIREBASE_ID,
          storageBucket: process.env.FIREBASE_BUCKET,
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
      });
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_ID,
        storageBucket: process.env.FIREBASE_BUCKET
      });
    }
}

const db = admin.firestore();

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
    'https://localhost:5000',
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

app.use(express.json());

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
  auth.authenticate(req, res);
})

app.get('/auth-status', async (req, res) => {
  auth.get_auth(req, res, admin.auth());
})

app.get('/callback', async (req, res) => {
  auth.callback(req, res, admin.auth(), db);
})

app.get('/get-albums/:collection', async (req, res) => {
  const auth_token = await auth.decodeToken(req, res, admin.auth());
    if (!auth_token) {
        console.error('Not authorized');
        return;
    }
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const albums = await getAlbums(token, db);

  if (typeof albums === 'object') {
    const collection = req.params.collection;
    const data = (await db.collection('photo_metadata').doc('collections').get()).data();
    if (typeof data === 'object') {
      albums['selected'] = data[collection]['album'];
    }
  }
  
  res.json(albums);
  console.log('Successfully fetched albums');
});

app.get('/get-collections', async (req, res) => {
  // const auth_token = await auth.decodeToken(req, res, admin.auth());
  //   if (!auth_token) {
  //       console.error('Not authorized');
  //       return;
  //   }
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const collections = (await db.collection('photo_metadata').doc('collections').get()).data();

  // if (typeof collections === 'object') {
  //   delete collections.homepage;
  // }

  res.json(collections);
  console.log('Successfully fetched collections');
})

app.put('/album-click/:id/:collection', async (req, res) => {
  console.log('Altering selected albums...');
  const auth_token = await auth.decodeToken(req, res, admin.auth());
    if (!auth_token) {
        console.error('Not authorized');
        return;
    }
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const key = req.params.id;
  const albums = (await db.collection(`photo_metadata`).doc('albums').get()).data();

  if (typeof albums === 'object') {
    if (!(key in albums)) {
      res.status(400).send('Cannot add new album');
      return;
    }

    const albumNumPhotos = Object.values(albums[key].photos).length;
    console.log(albumNumPhotos);

    // await db.collection(`photo_metadata`).doc('catalog').update({
    //   ['sel_photos']: FieldValue.increment(albums[key].selected ? albumNumPhotos : albumNumPhotos * -1)
    // })

    const collection = req.params.collection;
    const curr = (await db.collection('photo_metadata').doc('collections').get()).data();

    if (typeof curr === 'object') {
      const selected = curr[collection]['album'] === key;

      if (curr[collection].selected) {
        albums[key].selected += selected ? -1 : 1;
      }
      
      await db.collection('photo_metadata').doc('albums').update({
        [key]: albums[key]
      });

      await db.collection('photo_metadata').doc('collections').update({
        [collection]: {
          ['album']: selected ? '' : key,
          ['num_photos']: selected ? 0 : albumNumPhotos
        }
      });
    }

    // albums['selected'] = key;
    // await db.collection(`photo_metadata`).doc('albums').update({
    //   [key]: albums[key]
    // });
    res.json(albums);

    const token = await adobeSession.apiToken(db);
    
    await getAssets(token, db);
    console.log('Successfully altered albums');
  } else {
    console.error('Unexpected error occured when accessing albums metadata');
  }
});

app.put('/collection-click/:collection', async (req, res) => {
  const auth_token = await auth.decodeToken(req, res, admin.auth());
    if (!auth_token) {
        console.error('Not authorized');
        return;
    }
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const key = req.params.collection;
  const collections = (await db.collection(`photo_metadata`).doc('collections').get()).data();

  if (typeof collections === 'object') {
    if (!(key in collections)) {
      res.status(400).send('Cannot add new album');
      return;
    }

    console.log(collections[key].selected);
    collections[key].selected = !collections[key].selected;
    // const albumNumPhotos = Object.values(collections[key].photos).length;

    // await db.collection(`photo_metadata`).doc('catalog').update({
    //   ['sel_photos']: FieldValue.increment(collections[key].selected ? albumNumPhotos : albumNumPhotos * -1)
    // })

    await db.collection(`photo_metadata`).doc('collections').update({
      [key]: collections[key]
    });
    
    if (collections[key].album != '') {
      await db.collection('photo_metadata').doc('albums').update({
        [`${collections[key].album}.selected`]: FieldValue.increment(collections[key].selected ? 1 : -1)
      })
    }

    res.json(collections);

    const token = await adobeSession.apiToken(db);
    
    await getAssets(token, db);
    console.log('Successfully altered albums');
  } else {
    console.error('Unexpected error occured when accessing albums metadata');
  }
})

app.put('/reorder-collections', async (req, res) => {
  const auth_token = await auth.decodeToken(req, res, admin.auth());
  if (!auth_token) {
      console.error('Not authorized');
      return res.sendStatus(401);
  }

  const arr = req.body;
  const updateObj: { [key: string]: number } = {};
  for (let i = 0; i < arr.length; i++) {
    const coll = arr[i];
    updateObj[`${coll.name}.index`] = coll.index;
  }
  await db.collection('photo_metadata').doc('collections').update(updateObj);
  return res.sendStatus(204);
});

app.put('/add-collection/:collection', async (req, res) => {
  const auth_token = await auth.decodeToken(req, res, admin.auth());
  if (!auth_token) {
      console.error('Not authorized');
      return;
  }
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const key = req.params.collection;
  const collections = (await db.collection(`photo_metadata`).doc('collections').get()).data();

  if (typeof collections === 'object') {
    if (key in collections) {
      res.status(400).send('Cannot create duplicate collection');
      return;
    }

    const numColl = Object.values(collections).length - 1;
    collections[key] = {
      album: '',
      selected: false,
      num_photos: 0,
      index: numColl
    }

    await db.collection('photo_metadata').doc('collections').update({
      [key]: collections[key]
    })
    res.json(collections);
  } else {
    console.error('Unexpected error occured when accessing collections metadata');
  }
})

app.put('/del-collection/:collection', async (req, res) => {
  const auth_token = await auth.decodeToken(req, res, admin.auth());
    if (!auth_token) {
        console.error('Not authorized');
        return;
    }
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const key = req.params.collection;
  const collections = (await db.collection(`photo_metadata`).doc('collections').get()).data();

  if (typeof collections === 'object') {
    if (!(key in collections)) {
      res.status(400).send('Cannot delete collection that does not exist');
      return;
    }

    await db.collection('photo_metadata').doc('collections').update({
      [key]: FieldValue.delete()
    })

    if (collections[key].album != '' && collections[key].selected) {
      await db.collection('photo_metadata').doc('albums').update({
        [`${collections[key].album}.selected`]: FieldValue.increment(-1)
      })
    }

    res.json(collections);
  } else {
    console.error('Unexpected error occured when accessing collections metadata');
  }
})

app.get('/photos/:collection', async (req, res) => {
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const collection = req.params.collection;
  const collections = (await db.collection('photo_metadata').doc('collections').get()).data();
  if (typeof collections !== 'object') {
    res.status(404).send('An unexpected error occurred when fetching photos');
    return;
  }
  const album = collections[collection].album;
  const photoUrls = await fetchRenditions(token, db, album, '2048');
  res.json(photoUrls);
  console.log('Successfully fetched photos');
});

app.put('/reorder-photos/:album', async (req, res) => {
  const auth_token = await auth.decodeToken(req, res, admin.auth());
  if (!auth_token) {
      console.error('Not authorized');
      return res.sendStatus(401);
  }
  const album = req.params.album;
  const arr = req.body;
  const updateObj: { [key: string]: number } = {};
  for (let i = 0; i < arr.length; i++) {
    const photo = arr[i];
    const name = photo.href.replace('s/', '_');
    updateObj[`${album}.photos.${name}.index`] = photo.index;
  }
  await db.collection('photo_metadata').doc('albums').update(updateObj);
  console.log('Successfully updated order of photos');
  return res.sendStatus(204);
})

app.get('/thumbnails/:album', async (req, res) => {
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const album = req.params.album;
  const urls = await fetchRenditions(token, db, album, 'thumbnail2x');
  res.json(urls);
  console.log('Successfully fetched thumbnail urls');
})

app.put('/thumbnail-click/:collection/:thumbnail', async (req, res) => {
  const auth_token = await auth.decodeToken(req, res, admin.auth());
  if (!auth_token) {
      console.error('Not authorized');
      return;
  }
  const token = await auth.adobe_token(req, res, db);
  if (token == 'error') return console.error('No api token');

  const key = req.params.collection;
  const collections = (await db.collection(`photo_metadata`).doc('collections').get()).data();

  if (typeof collections === 'object') {
    if (!(key in collections)) {
      res.status(400).send('Cannot alter collection that does not exist');
      return;
    }

    const thumbnail = req.params.thumbnail;
    collections[key].thumbnail = collections[key].thumbnail === thumbnail ? '' : thumbnail;
    await db.collection('photo_metadata').doc('collections').update({
      [key]: collections[key]
    });

    res.json(collections);
  } else {
    console.error('Unexpected error occured when accessing collections metadata');
  }
})