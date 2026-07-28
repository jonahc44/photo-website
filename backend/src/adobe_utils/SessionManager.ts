import dotenv from 'dotenv'
import axios from 'axios'
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { db } from '../server';

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

// Refresh this far ahead of the real expiry so a token can't lapse mid-request.
const EXPIRY_MARGIN_MS = 60 * 1000;

// Adobe rotates the refresh token on every use, so two overlapping refreshes
// race: the loser persists a refresh token Adobe has already invalidated and
// the session is dead until the admin re-authenticates by hand. Collapse
// concurrent refreshes onto one in-flight request.
let inFlightRefresh: Promise<string> | null = null;

const fetchNewToken = async (refreshToken: string): Promise<string> => {
    const secrets = JSON.parse(process.env.SECRETS as string);
    const tokenUrl = 'https://ims-na1.adobelogin.com/ims/token/v3';

    const clientId = process.env.ENV === 'dev' ? secrets.dev_id : secrets.adobe_id;
    const clientSecret = process.env.ENV === 'dev' ? secrets.dev_secret : secrets.adobe_secret;
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    console.log('Fetching new api token...');
    const response = await axios.post<RefreshRes>(tokenUrl, `grant_type=refresh_token&refresh_token=${refreshToken}`, {
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const newAccess = response.data.access_token;
    // Adobe does not always issue a new refresh token; keep the current one if so.
    const newRefresh = response.data.refresh_token ?? refreshToken;
    const newExpiry = response.data.expires_in;

    // Awaited: callers read this token back, so the writes must land first.
    await Promise.all([
        db.collection('tokens').doc('api_token').update({
            value: newAccess,
            expiration: Timestamp.fromMillis(Date.now() + newExpiry * 1000)
        }),
        db.collection('tokens').doc('refresh_token').update({
            value: newRefresh
        })
    ]);

    return newAccess;
}

export const refreshApiToken = async (): Promise<string> => {
    const [apiTokenDoc, refreshTokenDoc] = await Promise.all([
        db.collection('tokens').doc('api_token').get(),
        db.collection('tokens').doc('refresh_token').get()
    ]);

    const expiryTime = apiTokenDoc.get('expiration') as Timestamp | undefined;
    const currentToken = apiTokenDoc.get('value') as string | undefined;

    if (currentToken && expiryTime && Date.now() + EXPIRY_MARGIN_MS < expiryTime.toMillis()) {
        return currentToken;
    }

    const refreshToken = refreshTokenDoc.get('value') as string | undefined;
    if (!refreshToken) {
        throw new Error('No Adobe refresh token stored; admin must sign in again at /auth');
    }

    if (!inFlightRefresh) {
        inFlightRefresh = fetchNewToken(refreshToken).finally(() => {
            inFlightRefresh = null;
        });
    }

    return inFlightRefresh;
}

// Returns a token guaranteed valid for at least EXPIRY_MARGIN_MS.
export const apiToken = async (): Promise<string> => {
    return refreshApiToken();
}