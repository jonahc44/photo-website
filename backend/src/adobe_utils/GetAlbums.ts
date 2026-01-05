import axios from 'axios'
import dotenv from 'dotenv'
import { getCatalog } from './GetCatalog';
import { db } from '../server';
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

export const getAlbums = async (token: string) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const catHref = await getCatalog(token);
    const url = `https://lr.adobe.io/v2/${catHref}/albums`;

    const clientId = process.env.ENV === 'dev' ? secrets.dev_id : secrets.adobe_id;
    const response = await axios.get<string>(url, {
        headers: {
            'X-API-Key': clientId,
            'Authorization': `Bearer ${token}`
        }
    });

    const stringData = response.data.replace('while (1) {}\n', '');
    const data = JSON.parse(stringData) as AlbumRes;

    const albumsFetch = await db.collection(`photo_metadata`).doc('albums').get();
    let albums = albumsFetch.exists ? albumsFetch.data() : {};
    for (var i = 0; i < data.resources.length; i++) {
        const album = data.resources[i];
        const key = `album_${album.id}`;
        
        if (typeof albums === 'object') {
            if (!(key in albums)) {
                albums[key] = {
                    name: album.payload.name,
                    href: album.links.self.href,
                    collection: '',
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