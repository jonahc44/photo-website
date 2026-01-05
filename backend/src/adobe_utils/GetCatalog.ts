import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path';
import { db } from '../server';
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
    const catalog = await db.collection('photo_metadata').doc('catalog').get();

    if (catalog.exists) {
        return await catalog.get('href');
    }

    const secrets = JSON.parse(process.env.SECRETS as string);
    const url = 'https://lr.adobe.io/v2/catalog';

    const clientId = process.env.ENV === 'dev' ? secrets.dev_id : secrets.adobe_id;
    const response = await axios.get<string>(url, {
        headers: {
            'X-API-Key': clientId,
            'Authorization': `Bearer ${token}`
        }
    });

    const stringData = response.data.replace('while (1) {}\n', '');
    const data = JSON.parse(stringData) as CatalogRes;
    const link = data.links.self.href;

    try {
        await db.collection('photo_metadata').doc('catalog').set({'href': link});
    } catch (err) {
        console.error(err);
    }
   
    return link;
}