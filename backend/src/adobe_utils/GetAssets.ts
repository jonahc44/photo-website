import axios from 'axios'
import dotenv from 'dotenv'
import { db } from '../server'
import { getCatalog } from './GetCatalog'
import { admin } from '../server';
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

interface AssetRes {
    resources: [Asset],
    links: {
        prev: {
            href: string
        },
        next: {
            href: string
        }
    }
};

export const getAssets = async (token: string) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const catHref = await getCatalog(token);
    const baseUrl = `https://lr.adobe.io/v2/${catHref}/`;
    const albums = (await db.collection('photo_metadata').doc('albums').get()).data();
    const updates: { [key: string]: any } = {};
    const storageDeletionTasks: Promise<any>[] = [];

    if (typeof albums === 'object' && albums !== null) {
        
        for (const [albumKey, albumData] of Object.entries(albums)) {
            const album = albumData as Album;

            if (album.collection !== '') {
                const currentPhotos = album.photos || {};
                let runningIndex = Object.keys(currentPhotos).length;
                let adobeAssetsMap = new Set<string>();
                let nextHref = `${album.href}/assets`; 

                try {
                    while (nextHref) {
                        const url = nextHref.startsWith('http') 
                            ? nextHref 
                            : `${baseUrl}${nextHref.startsWith('/') ? '' : '/'}${nextHref}`;

                        const clientId = process.env.ENV === 'dev' ? secrets.dev_id : secrets.adobe_id;
                        const response = await axios.get<string>(url, {
                            headers: {
                                'X-API-Key': clientId,
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        const stringData = response.data.replace('while (1) {}\n', '');
                        const data = JSON.parse(stringData) as AssetRes;

                        for (const resource of data.resources) {
                            if (!resource?.asset?.links?.self?.href) {
                                continue;
                            }

                            const asset = resource.asset;
                            const href = asset.links.self.href;

                            if (!href.startsWith('assets') && !href.startsWith('/assets')) {
                                continue;
                            }
                            const assetKey = `asset_${asset.id}`;
                            adobeAssetsMap.add(assetKey);

                            if (!(assetKey in currentPhotos)) {
                                updates[`${albumKey}.photos.${assetKey}`] = {
                                    href: asset.links.self.href,
                                    url: '',
                                    thumbnail: '',
                                    index: runningIndex
                                };
                                runningIndex++;
                            }
                        }

                        if (data.links && data.links.next) {
                            nextHref = data.links.next.href;
                        } else {
                            nextHref = '';
                        }
                    }

                    for (const existingKey of Object.keys(currentPhotos)) {
                        if (!adobeAssetsMap.has(existingKey)) {
                            const bucket = admin.storage().bucket();
                            const photoFile = bucket.file(`photos/${existingKey}.jpg`);
                            const thumbFile = bucket.file(`thumbnails/${existingKey}.jpg`);
                            
                            storageDeletionTasks.push(photoFile.delete().catch(() => {}));
                            storageDeletionTasks.push(thumbFile.delete().catch(() => {}));

                            updates[`${albumKey}.photos.${existingKey}`] = admin.firestore.FieldValue.delete();
                        }
                    }

                } catch (e) {
                    console.error(`Failed to sync assets for ${albumKey}`, e);
                }
            }
        }
    }

    if (storageDeletionTasks.length > 0) {
        await Promise.all(storageDeletionTasks);
        console.log(`Cleaned up ${storageDeletionTasks.length / 2} photos from Storage.`);
    }

    if (Object.keys(updates).length > 0) {
        try {
            await db.collection('photo_metadata').doc('albums').update(updates);
        } catch (err) {
            console.error(err);
        }
    }
}