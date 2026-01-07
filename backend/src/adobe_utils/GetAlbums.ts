import axios from 'axios'
import dotenv from 'dotenv'
import { getCatalog } from './GetCatalog'
import { db, admin } from '../server'
dotenv.config();

interface Album {
    name: string;
    href: string;
    collection: string;
    photos: {
        [key: string]: {
            href: string;
            url: string;
            thumbnail: string;
            index: number;
        };
    };
}

interface AlbumResource {
    id: string;
    payload: {
        name: string;
    };
    links: {
        self: {
            href: string;
        };
    };
}

interface AlbumRes {
    resources: AlbumResource[];
    links?: {
        next?: {
            href: string;
        };
        prev?: {
            href: string;
        };
    };
};

export const getAlbums = async (token: string) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const catHref = await getCatalog(token);
    const baseUrl = `https://lr.adobe.io/v2/${catHref}`;

    const albumsDocRef = db.collection('photo_metadata').doc('albums');
    const albumsFetch = await albumsDocRef.get();
    const currentAlbums = albumsFetch.exists ? albumsFetch.data() : {};
    
    const updates: { [key: string]: any } = {};
    const storageDeletionTasks: Promise<any>[] = [];
    const adobeAlbumsSet = new Set<string>();

    let nextHref = `${baseUrl}/albums`; 

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
            const data = JSON.parse(stringData) as AlbumRes;

            for (const album of data.resources) {
                const key = `album_${album.id}`;
                adobeAlbumsSet.add(key);

                if (currentAlbums && (key in currentAlbums)) {
                    const existingAlbum = currentAlbums[key] as Album;
                    if (existingAlbum.name !== album.payload.name) {
                        updates[`${key}.name`] = album.payload.name;
                    }
                } else {
                    updates[key] = {
                        name: album.payload.name,
                        href: album.links.self.href,
                        collection: '',
                        photos: {}
                    };
                }
            }

            if (data.links && data.links.next) {
                nextHref = data.links.next.href;
            } else {
                nextHref = '';
            }
        }

        if (typeof currentAlbums === 'object' && currentAlbums !== null) {
            for (const existingKey of Object.keys(currentAlbums)) {
                if (!adobeAlbumsSet.has(existingKey)) {
                    
                    const albumData = currentAlbums[existingKey] as Album;
                    if (albumData.photos) {
                        const bucket = admin.storage().bucket();
                        for (const photoKey of Object.keys(albumData.photos)) {
                            const photoFile = bucket.file(`photos/${photoKey}.jpg`);
                            const thumbFile = bucket.file(`thumbnails/${photoKey}.jpg`);
                            
                            storageDeletionTasks.push(photoFile.delete().catch(() => {}));
                            storageDeletionTasks.push(thumbFile.delete().catch(() => {}));
                        }
                    }

                    updates[existingKey] = admin.firestore.FieldValue.delete();
                }
            }
        }

        if (storageDeletionTasks.length > 0) {
            await Promise.all(storageDeletionTasks);
            console.log(`Cleaned up files for deleted albums.`);
        }

        if (Object.keys(updates).length > 0) {
            await albumsDocRef.set(updates, { merge: true });
        }

    } catch (err) {
        console.error("Error syncing albums:", err);
    }

    return { ...currentAlbums, ...updates }; 
}