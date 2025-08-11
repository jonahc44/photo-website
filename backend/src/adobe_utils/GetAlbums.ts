import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { Firestore } from 'firebase-admin/firestore';
dotenv.config();

interface Album {
    id: string,
    payload: {
        name: string
    },
    links: {
        self: {
            href: string
        }
    }
}

interface AlbumRes {
    resources: [Album]
};

export const getAlbums = async (token: string, db: Firestore) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const catalog = await db.collection(`photo_metadata`).doc('catalog').get();
    const catHref = await catalog.get('href');
    const url = `https://lr.adobe.io/v2/${catHref}/albums`;

    const response = await axios.get<string>(url, {
        headers: {
            'X-API-Key': `${secrets.adobe_id}`,
            'Authorization': `Bearer ${token}`
        }
    });

    const stringData = response.data.replace('while (1) {}\n', '');
    const data = JSON.parse(stringData) as AlbumRes;

    let albums = (await db.collection(`photo_metadata`).doc('albums').get()).data();
    for (var i = 0; i < data.resources.length; i++) {
        const album = data.resources[i];
        const key = `album_${album.id}`;
        
        if (typeof albums === 'object') {
            if (!(key in albums)) {
                albums[key] = {
                    name: album.payload.name,
                    href: album.links.self.href,
                    selected: 0,
                    photos: {}
                }
            }
        }
    }

    try {
        if (typeof albums === 'object') await db.collection(`photo_metadata`).doc('albums').set(albums);
        else throw new Error;
    } catch (err) {
        console.error(err);
    }

    return albums;
}