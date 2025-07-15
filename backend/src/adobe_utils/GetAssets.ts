import axios from 'axios'
import dotenv from 'dotenv'
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
            index: number
        }
    }
}

interface AssetRes {
    resources: [Asset]
};

export const getAssets = async (token: string) => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const config = fs.readFileSync(path.join(__dirname, '../photo_config.json'), 'utf-8');
    const jsonConfig = JSON.parse(config);
    const catHref = jsonConfig.href;
    const baseUrl = `https://lr.adobe.io/v2/${catHref}/`;
    let numPhotos = jsonConfig.total_photos;
    
    for (const albumKey in jsonConfig.albums) {
        const album = jsonConfig.albums[albumKey] as Album;
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
                        index: numPhotos
                    }
                    numPhotos++;
                }
            }
        }
    }

    jsonConfig.total_photos = numPhotos;

    try {
        const file = path.join(__dirname, '../photo_config.json');
        fs.writeFileSync(file, JSON.stringify(jsonConfig, null, 2));
    } catch (err) {
        console.error(err);
    }
}