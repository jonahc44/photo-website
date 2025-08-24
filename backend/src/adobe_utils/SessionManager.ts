import dotenv from 'dotenv'
import axios from 'axios'
import { Firestore, Timestamp } from 'firebase-admin/firestore';

dotenv.config();

interface DbRow {
    id: number,
    // auth: number,
    api_token: string,
    refresh_token: string,
    expires_in: number,
    last_refreshed: Date
}

interface RefreshRes {
    access_token: string,
    refresh_token: string,
    token_type: string,
    expires_in: number
}

export const createSession = async (apiToken: string, refreshToken: string, expiresIn: number, db: Firestore) => {
    console.log('Adding tokens');

    try {
        await db.collection('tokens').doc('api_token').set({
            value: apiToken,
            expiration: Timestamp.fromMillis(Date.now() + expiresIn * 1000)
        });

        await db.collection('tokens').doc('refresh_token').set({value: refreshToken});
    } catch (err) {
        console.error(`Error storing ${apiToken} and ${refreshToken}:\n${err}`);
        throw new Error('Failed to store api tokens');
    }
}

export const refreshApiToken = async (db: Firestore) => {
    const apiToken = await db.collection('tokens').doc('api_token').get();
    const refreshToken = (await db.collection('tokens').doc('refresh_token').get()).get('value');
    const expiryTime = apiToken.get('expiration');
    const currTime = Timestamp.now();

    if (currTime >= expiryTime) {
        const secrets = JSON.parse(process.env.SECRETS as string);
        const tokenUrl = 'https://ims-na1.adobelogin.com/ims/token/v3';
        const authString = Buffer.from(`${secrets.adobe_id}:${secrets.adobe_secret}`).toString('base64');

        console.log('Fetching new api token...');
        await axios.post<RefreshRes>(tokenUrl, `grant_type=refresh_token&refresh_token=${refreshToken}`, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(response => {
            const newAccess = response.data.access_token;
            const newRefresh = response.data.refresh_token;
            const newExpiry = response.data.expires_in;

            db.collection('tokens').doc('api_token').update({
                value: newAccess,
                expiration: Timestamp.fromMillis(Date.now() + newExpiry * 1000)
            });

            db.collection('tokens').doc('refresh_token').update({
                value: newRefresh
            })
        })
    }
}

export const apiToken = async (db: Firestore) => {
    await refreshApiToken(db);

    const tokenInfo = await db.collection('tokens').doc('api_token').get();
    return tokenInfo.get('value');
}