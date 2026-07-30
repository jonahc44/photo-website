import dotenv from 'dotenv'
import axios from 'axios'
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { db } from '../server';
import { AdobeAuthError } from './errors';

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

export const createSession = async (apiToken: string, refreshToken: string, expiresIn: number) => {
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

// Refresh a little early so a token that is about to lapse doesn't get used mid-request.
const EXPIRY_SKEW_MS = 60 * 1000;

export const refreshApiToken = async () => {
    const apiToken = await db.collection('tokens').doc('api_token').get();
    const refreshToken = (await db.collection('tokens').doc('refresh_token').get()).get('value');
    const expiryTime = apiToken.get('expiration') as Timestamp | undefined;

    if (!refreshToken) {
        throw new AdobeAuthError('No Adobe refresh token stored. Sign in with Adobe again.');
    }

    // A missing expiration means we can't trust the stored token, so refresh it.
    if (!expiryTime || Date.now() + EXPIRY_SKEW_MS >= expiryTime.toMillis()) {
        const secrets = JSON.parse(process.env.SECRETS as string);
        const tokenUrl = 'https://ims-na1.adobelogin.com/ims/token/v3';

        const clientId = process.env.ENV === 'dev' ? secrets.dev_id : secrets.adobe_id;
        const clientSecret = process.env.ENV === 'dev' ? secrets.dev_secret : secrets.adobe_secret;
        const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        console.log('Fetching new api token...');
        let response;
        try {
            response = await axios.post<RefreshRes>(tokenUrl, `grant_type=refresh_token&refresh_token=${refreshToken}`, {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        } catch (err) {
            console.error('Failed to refresh Adobe api token:', err);

            // Only a rejection from Adobe means the session is dead - a network
            // blip shouldn't log the admin out.
            const status = axios.isAxiosError(err) ? err.response?.status : undefined;
            if (status && status >= 400 && status < 500) {
                throw new AdobeAuthError('Adobe rejected the stored refresh token. Sign in with Adobe again.');
            }

            throw err;
        }

        const newAccess = response.data.access_token;
        const newRefresh = response.data.refresh_token;
        const newExpiry = response.data.expires_in;

        await db.collection('tokens').doc('api_token').set({
            value: newAccess,
            expiration: Timestamp.fromMillis(Date.now() + newExpiry * 1000)
        });

        if (newRefresh) {
            await db.collection('tokens').doc('refresh_token').set({ value: newRefresh });
        }
    }
}

export const apiToken = async () => {
    await refreshApiToken();

    const tokenInfo = await db.collection('tokens').doc('api_token').get();
    const token = tokenInfo.get('value');

    if (!token) {
        throw new AdobeAuthError('No Adobe api token stored. Sign in with Adobe again.');
    }

    return token as string;
}