import axios from 'axios'
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
            href: string
        }
    }
}

export const getRenditions = async (token: string) => {
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
            for (var i = 0; i < keys.length; i++) {
                const href = photos[keys[i]].href;

                // try {
                //     await axios.post(`${baseUrl}${href}/renditions`, '', {
                //         headers: {
                //             'X-API-Key': `${process.env.ADOBE_ID}`,
                //             'Authorization': `Bearer ${token}`,
                //             'X-Generate-Renditions': 'fullsize'
                //         }
                //     })
                // } catch (err) {
                //     console.log('Error creating fullsize rendition');
                //     console.log(err);
                // }

                try {
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
                    // const baseData = Buffer.from(binaryData).toString('base64');
                    const filename = `${keys[i]}.jpg`;

                    try {
                        const file = bucket.file(`photos/${filename}`);
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
                            // console.log('Image uploaded');
                            try {
                                const [url] = await file.getSignedUrl({
                                    action: 'read',
                                    expires: '03-09-2400'
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

                    // const imagesDirectory = path.join(__dirname, '../public/photos');
                    // fs.writeFile(path.join(imagesDirectory, filename), binaryData, (err) => {
                    //     if (err) {
                    //       console.error('Error saving the image:', err);
                    //     } else {
                    //       console.log('Image saved successfully:', filename);
                    //     }
                    //   });
                    // allData.push(`gs://${process.env.BUCKET_NAME}/photos/${filename}`);
                } catch (err) {
                    console.error('Error fetching image:', err);
                }
            }
        }
    }

    return allData;
}