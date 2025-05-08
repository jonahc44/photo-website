import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path';
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
    const config = fs.readFileSync(path.join(__dirname, '../photo_config.json'), 'utf-8');
    const jsonConfig = JSON.parse(config);
    const catHref = jsonConfig.href;
    const url = `https://lr.adobe.io/v2/${catHref}/albums`;

    const response = await axios.get<string>(url, {
        headers: {
            'X-API-Key': `${process.env.ADOBE_ID}`,
            'Authorization': `Bearer ${token}`
        }
    });

    const stringData = response.data.replace('while (1) {}\n', '');
    const data = JSON.parse(stringData) as AlbumRes;

    for (var i = 0; i < data.resources.length; i++) {
        const album = data.resources[i];
        const key = `album_${album.id}`;
        if (!(key in jsonConfig.albums))
            jsonConfig.albums[key] = {
                name: album.payload.name,
                href: album.links.self.href,
                selected: false,
                photos: {}
            }
    }

    try {
        const file = path.join(__dirname, '../photo_config.json');
        fs.writeFileSync(file, JSON.stringify(jsonConfig, null, 2));
    } catch (err) {
        console.error(err);
    }
}