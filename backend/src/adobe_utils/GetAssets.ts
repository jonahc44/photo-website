import axios from 'axios'
import dotenv from 'dotenv'
import { db } from '../server'
import { getCatalog } from './GetCatalog'
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
    selected: number,
    photos: {
        [key: string]: {
            href: string,
            url: string,
            thumbnail: string,
            index: number
        }
    }
}

interface AssetRes {
    resources: [Asset]
};

export const getAssets = async (token: string) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const catHref = await getCatalog(token);
    const baseUrl = `https://lr.adobe.io/v2/${catHref}/`;
    const albums = (await db.collection('photo_metadata').doc('albums').get()).data();

    if (typeof albums === 'object') {
        for (const albumKey in albums) {
            let numPhotos = 0;
            const album = albums[albumKey] as Album;
            if (album.selected > 0) {
                const url = `${baseUrl}${album.href}/assets`;

                const clientId = process.env.ENV === 'dev' ? secrets.dev_id : secrets.adobe_id;
                const response = await axios.get<string>(url, {
                    headers: {
                        'X-API-Key': clientId,
                        'Authorization': `Bearer ${token}`
                    }
                });

                const stringData = response.data.replace('while (1) {}\n', '');
                const data = JSON.parse(stringData) as AssetRes;

                for (var i = 0; i < data.resources.length; i++) {
                    const asset = data.resources[i].asset;
                    const key = `asset_${asset.id}`;

                    if (!(key in album.photos)) {
                        album.photos[key] = {
                            href: asset.links.self.href,
                            url: '',
                            thumbnail: '',
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

    // await db.collection('photo_metadata').doc('catalog').update({
    //     ['sel_photos']: numPhotos
    // });

    try {
        if (typeof albums === 'object') await db.collection('photo_metadata').doc('albums').set(albums);
        else throw new Error;
    } catch (err) {
        console.error(err);
    }
}