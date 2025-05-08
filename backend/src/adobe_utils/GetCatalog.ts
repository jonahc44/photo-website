import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path';
dotenv.config();

interface CatalogRes {
    payload: {
        name: string
    },
    links: {
        self: {
            href: string
        }
    }
    
}

export const getCatalog = async (token: string) => {
    const url = 'https://lr.adobe.io/v2/catalog';

    const response = await axios.get<string>(url, {
        headers: {
            'X-API-Key': `${process.env.ADOBE_ID}`,
            'Authorization': `Bearer ${token}`
        }
    });

    const stringData = response.data.replace('while (1) {}\n', '');
    const data = JSON.parse(stringData) as CatalogRes;
    const name = data.payload.name;
    const link = data.links.self.href;

    const jsonData = {
        name: name,
        href: link,
        albums: {},
    }

    try {
        const file = path.join(__dirname, '../photo_config.json');
        fs.writeFileSync(file, JSON.stringify(jsonData, null, 2));
    } catch (err) {
        console.error(err);
    }
   
}