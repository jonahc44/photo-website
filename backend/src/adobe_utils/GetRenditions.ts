import axios from 'axios'
import { Response } from 'express'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import * as admin from 'firebase-admin'
// import serviceAccount from '../serviceAccountKey.json'
dotenv.config();

interface Album {
    name: string,
    href: string,
    selected: boolean,
    photos: {
        [key: string]: {
            href: string,
            index: number
        }
    }
}

export const fetchRenditions = async (token: string, db: admin.firestore.Firestore) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    
    if (!admin.apps.length){
        if (process.env.ENV == 'dev') {
            const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../serviceAccountKey.json'), 'utf8'));
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
    
    const bucket = admin.storage().bucket();
    const config = fs.readFileSync(path.join(__dirname, '../photo_config.json'), 'utf-8');
    const jsonConfig = JSON.parse(config);
    const catHref = jsonConfig.href;
    const baseUrl = `https://lr.adobe.io/v2/${catHref}/`;
    
    const allData: any[] = [];
    for (const albumKey in jsonConfig.albums) {
        const album = jsonConfig.albums[albumKey] as Album;
        if (album.selected) {
            const keys = Object.keys(album.photos);
            const photos = album.photos;

            const fetchAll = async (key: string) => {
                const href = photos[key].href;
                try {
                    const filename = `${key}.jpg`;
                    const file = bucket.file(`photos/${filename}`);
                    const [exists] = await file.exists();

                    if (!exists) {
                        const response = await axios.get(`${baseUrl}${href}/renditions/2048`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'X-API-Key': secrets.adobe_id,
                                'Accept': 'image/jpeg',
                                'Cache-Control': 'max-age=1800000'
                            },
                            responseType: 'arraybuffer'
                        });

                        const binaryData = await response.data as ArrayBuffer;
                        try {
                            const writeStream = file.createWriteStream({
                                metadata: {
                                    contentType: 'image/jpeg'
                                },
                                resumable: false
                            });

                            writeStream.on('error', (err) => {
                                console.error('Error when uploading photo:', err);
                            });

                            writeStream.on('finish', async () => {
                                try {
                                    const [url] = await file.getSignedUrl({
                                        action: 'read',
                                        expires: '03-09-2400'
                                    });

                                    await db.collection('photo_metadata').doc(filename).set({
                                        url: url,
                                        index: photos[key].index
                                    });
                                    allData.push(url);
                                } catch (err) {
                                    console.error('Could not get signed url:', err);
                                }
                            });

                            writeStream.end(binaryData);
                        } catch (err) {
                            console.error('Error uploading images: ', err);
                        }
                    } else {
                        const metadata = await db.collection('photo_metadata').doc(filename).get();
                        const url = await metadata.get('url');
                        const index = await metadata.get('index');
                        allData.push({
                            url: url,
                            index: index
                        });
                    }
                } catch (err) {
                    console.error('Error fetching image:', err);
                }
            }

            await Promise.all(keys.map(key => fetchAll(key)));
        }
    }
    return allData;
}