import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import * as admin from 'firebase-admin'
import { File } from '@google-cloud/storage';
import { db } from '../server'
import { getCatalog } from './GetCatalog'
// import serviceAccount from '../serviceAccountKey.json'
dotenv.config();

interface Album {
    name: string,
    href: string,
    collection: string,
    photos: {
        [key: string]: {
            href: string,
            url: string,
            thumbnail: string,
            index: number
        }
    }
}

export const fetchRenditions = async (token: string, currAlbum: string, type: string) => {
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
    const catHref = await getCatalog(token);
    const baseUrl = `https://lr.adobe.io/v2/${catHref}/`;
    
    let albums = (await db.collection('photo_metadata').doc('albums').get()).data();
    let allData: any[] = [];

    const getHeaders = (clientId: string) => ({
        'Authorization': `Bearer ${token}`,
        'X-API-Key': clientId,
        'Accept': 'image/jpeg',
        'Cache-Control': 'max-age=1800000'
    });
    
    for (const albumKey in albums) {
        const album = albums[albumKey] as Album;
        if (album.collection !== '' && albumKey === currAlbum) {
            const keys = Object.keys(album.photos);
            const photos = album.photos;

            const fetchAll = async (key: string) => {
                const href = photos[key].href;
                
                try {
                    const filename = `${key}.jpg`;
                    let file: File;

                    if (type === 'thumbnail2x') {
                        file = bucket.file(`thumbnails/${filename}`)
                    } else {
                        file = bucket.file(`photos/${filename}`)
                    }

                    const [exists] = await file.exists();

                    if (!exists) {
                        const clientId = process.env.ENV === 'dev' ? secrets.dev_id : secrets.adobe_id;
                        let binaryData: ArrayBuffer | null = null;
                        
                        try {
                            const response = await axios.get(`${baseUrl}${href}/renditions/${type}`, {
                                headers: getHeaders(clientId),
                                responseType: 'arraybuffer'
                            });
                            binaryData = response.data as ArrayBuffer;
                        } catch (err: any) {
                            if (type === '2048' && err.response && err.response.status === 404) {
                                console.warn(`Rendition 2048 not found for ${key}. Falling back to 1280.`);
                                
                                try {
                                    const fallbackType = '1280'; 
                                    const response = await axios.get(`${baseUrl}${href}/renditions/${fallbackType}`, {
                                        headers: getHeaders(clientId),
                                        responseType: 'arraybuffer'
                                    });
                                    binaryData = response.data as ArrayBuffer;
                                } catch (fallbackErr: any) {
                                    if (fallbackErr.response?.data) {
                                        const errStr = fallbackErr.response.data.toString('utf8');
                                        console.error(`Fallback failed for ${key}. Adobe Error:`, errStr.replace(/^while\s*\(\d+\)\s*\{\}\s*/, ''));
                                    }
                                    throw fallbackErr;
                                }
                            } else {
                                
                                throw err;
                            }
                        }

                        if (binaryData) {
                            try {
                                await new Promise<void>((res, rej) => {
                                    const writeStream = file.createWriteStream({
                                        metadata: {
                                            contentType: 'image/jpeg'
                                        },
                                        resumable: false
                                    });

                                    writeStream.on('error', (err) => {
                                        console.error('Error when uploading photo:', err);
                                        rej(err);
                                    });

                                    writeStream.on('finish', async () => {
                                        try {
                                            const [url] = await file.getSignedUrl({
                                                action: 'read',
                                                expires: '03-09-2400'
                                            });

                                            if (typeof albums === 'object') {
                                                if (type === 'thumbnail2x') {
                                                    albums[albumKey].photos[key].thumbnail = url;
                                                } else {
                                                    albums[albumKey].photos[key].url = url;
                                                }
                                            }
                                            res();
                                        } catch (err) {
                                            console.error('Could not get signed url:', err);
                                            rej(err);
                                        }
                                    });

                                    writeStream.end(Buffer.from(binaryData));
                                });
                            } catch (err) {
                                console.error('Error uploading images: ', err);
                            }
                        }
                    } else {
                        const [url] = await file.getSignedUrl({
                            action: 'read',
                            expires: '03-09-2400'
                        });
                        if (type === 'thumbnail2x') {
                            albums[albumKey].photos[key].thumbnail = url;
                        } else {
                            albums[albumKey].photos[key].url = url;
                        }
                    }
                } catch (err) {
                    console.error(`Final error processing ${key}:`, err);
                }
            }

            await Promise.all(keys.map(key => fetchAll(key)));
            allData = Object.values(albums[albumKey].photos).concat(allData);
        }
        await db.collection('photo_metadata').doc('albums').set(albums);
    }
    return allData;
}