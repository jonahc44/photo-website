import axios from 'axios'
import dotenv from 'dotenv'
import { Firestore } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'
dotenv.config();

interface Asset {
    asset: {
        id: string,
        links: {
            self: {
                href: string
            }
        }
    }
}

interface Album {
    name: string,
    href: string,
    selected: boolean,
    photos: {
        [key: string]: {
            href: string,
            url: string,
            index: number
        }
    }
}

interface AssetRes {
    resources: [Asset]
};

export const getAssets = async (token: string, db: Firestore) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const catalog = await db.collection('photo_metadata').doc('catalog').get();
    const catHref = await catalog.get('href');
    const baseUrl = `https://lr.adobe.io/v2/${catHref}/`;
    let numPhotos = await catalog.get('sel_photos');
    
    const albums = (await db.collection('photo_metadata').doc('albums').get()).data();

    if (typeof albums === 'object') {
        for (const albumKey in albums) {
            const album = albums[albumKey] as Album;
            if (album.selected) {
                const url = `${baseUrl}${album.href}/assets`;

                const response = await axios.get<string>(url, {
                    headers: {
                        'X-API-Key': `${secrets.adobe_id}`,
                        'Authorization': `Bearer ${token}`
                    }
                });

                const stringData = response.data.replace('while (1) {}\n', '');
                const data = JSON.parse(stringData) as AssetRes;

                for (var i = 0; i < data.resources.length; i++) {
                    const asset = data.resources[i].asset;
                    const key = `asset_${asset.id}`;

                    if (!(key in album.photos)) {
                        // try {
                        //     await axios.head<string>(`${baseUrl}${asset.links.self.href}/renditions/fullsize`, {
                        //         headers: {
                        //             'X-API-Key': `${process.env.ADOBE_ID}`,
                        //             'Authorization': `Bearer ${token}`
                        //         }
                        //     });
                        // } catch (err) {
                        //     try {
                        //         await axios.post(`${baseUrl}${asset.links.self.href}/renditions`, '', {
                        //             headers: {
                        //                 'X-API-Key': `${process.env.ADOBE_ID}`,
                        //                 'Authorization': `Bearer ${token}`,
                        //                 'X-Generate-Renditions': 'fullsize'
                        //             }
                        //         })
                        //     } catch (err2) {
                        //         console.log('Error creating fullsize rendition');
                        //         console.log(err2);
                        //     }
                        // }

                        album.photos[key] = {
                            href: asset.links.self.href,
                            url: '',
                            index: numPhotos
                        }
                        numPhotos++;
                    }
                }
            }
        }
    } else {
        console.error('Unexpected error occurred while accessing albums metadata');
        return;
    }

    await db.collection('photo_metadata').doc('catalog').update({
        ['sel_photos']: numPhotos
    });

    try {
        if (typeof albums === 'object') await db.collection('photo_metadata').doc('albums').set(albums);
        else throw new Error;
    } catch (err) {
        console.error(err);
    }
}