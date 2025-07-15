import sqlite3 from 'sqlite3'
import dotenv from 'dotenv'
import axios from 'axios'
import { Firestore, Timestamp } from 'firebase-admin/firestore';

// const db = new sqlite3.Database('./tokens.db');
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

// export const getAuth = () => {
//     return new Promise((resolve, reject) =>
//         db.get<DbRow>(`SELECT auth FROM tokens ORDER BY last_refreshed DESC LIMIT 1`, (err, row) => {
//             if (err || !row) {
//                 resolve(0);
//             }

//             resolve(row.auth);
//     }));
// }

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
    
    
    // db.serialize(() => {
    //     db.run(`CREATE TABLE IF NOT EXISTS tokens (
    //       id INTEGER PRIMARY KEY AUTOINCREMENT,
          
    //       api_token TEXT NOT NULL,
    //       refresh_token TEXT NOT NULL,
    //       expires_in INTEGER NOT NULL,
    //       last_refreshed DATETIME DEFAULT CURRENT_TIMESTAMP
    //     )`);
    // });

    // const stmt = db.prepare(`REPLACE into tokens (api_token, refresh_token, expires_in) VALUES (?, ?, ?)`);
    // stmt.run(apiToken, refreshToken, expiresIn, function (err: any) {
    //     if (err) {
    //       return console.error('Error inserting tokens:', err.message);
    //     }
    //     console.log('Tokens stored');
    // });
    // stmt.finalize();
    // db.close();
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
        axios.post<RefreshRes>(tokenUrl, `grant_type=refresh_token&refresh_token=${refreshToken}`, {
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

    // db.get<DbRow>(`SELECT api_token, refresh_token, expires_in, last_refreshed FROM tokens ORDER BY last_refreshed DESC LIMIT 1`, (err, row) => {
    //     if (err || !row) {
    //       return console.error('No tokens found or error retrieving tokens.');
    //     }

    //     const currTime = Date.now();
    //     const expiryTime = new Date(row.last_refreshed).getTime() + row.expires_in * 1000;
    //     if (currTime >= expiryTime) {
    //         const tokenUrl = 'https://ims-na1.adobelogin.com/ims/token/v3';
    //         const authString = Buffer.from(`${process.env.ADOBE_ID}:${process.env.ADOBE_SECRET}`).toString('base64');

    //         axios.post<RefreshRes>(tokenUrl, `grant_type=refresh_token&refresh_token=${row.refresh_token}`, {
    //             headers: {
    //                 'Authorization': `Basic ${authString}`,
    //                 'Content-Type': 'application/x-www-form-urlencoded'
    //             }
    //         }).then(response => {
    //             const newAccess = response.data.access_token;
    //             const newRefresh = response.data.refresh_token;
    //             const newExpiry = response.data.expires_in;
    //             const stmt = db.prepare(`REPLACE into tokens (api_token, refresh_token, expires_in) VALUES (?, ?, ?)`);

    //             stmt.run(newAccess, newRefresh, newExpiry, function (err: any) {
    //                 if (err) {
    //                   return console.error('Error inserting tokens:', err.message);
    //                 }
    //                 console.log('Tokens stored');
    //               });
    //               stmt.finalize();
    //         })
    //     }
    // });
    // db.close();
}

export const apiToken = async (db: Firestore) => {
    refreshApiToken(db);

    const tokenInfo = await db.collection('tokens').doc('api_token').get();
    return tokenInfo.get('value');
    // return new Promise<string>((resolve, reject) =>
    //     db.get<DbRow>(`SELECT api_token, refresh_token, expires_in, last_refreshed FROM tokens ORDER BY last_refreshed DESC LIMIT 1`, (err, row) => {
    //         if (err || !row) {
    //             resolve('error');
    //             return console.error('No tokens found or error retrieving tokens.');
    //         }
            
    //         resolve(row.api_token);
    //     }
    // ));
}

// export const logout = () => {
//     const stmt = db.prepare(`REPLACE into tokens (auth) VALUES (?)`);
//     stmt.run(0, function (err: any) {
//         if (err) {
//             return console.error('Error logging out');
//         }
        
//         stmt.finalize();
//     })
// }

// process.on('SIGTERM', () => {
//     db.close((err) => {
//         if (err) {
//             return console.error('Error closing the database:', err.message);
//         }
//         console.log('Database connection closed.');
//     });
// })