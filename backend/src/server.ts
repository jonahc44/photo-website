import express  from 'express'
import axios from 'axios'
import qs from 'qs'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
import passport from 'passport-oauth2'
dotenv.config()

interface TokenResponse {
    access_token: string
}
const app = express();
const PORT = 5000;

app.use(cors({
    origin: 'http://localhost:3000'
}))

app.get('/', (req, res) => {
    res.send('Hello World!');
  });

// app.post('/api/getAccessToken', async (req, res) => {
//   try {
//     const data = qs.stringify({
//       grant_type: 'client_credentials',
//       client_id: process.env.LIGHTROOM_ID,
//       client_secret: process.env.LIGHTROOM_SECRET,
//       scope: 'openid AdobeID read_organizations',
//     });

//     const response = await axios.post<TokenResponse>(
//       'https://ims-na1.adobelogin.com/ims/token/v3',
//       data,
//       {
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       }
//     );

//     res.json({ accessToken: response.data.access_token });
//   } catch (error: any) {
//     console.error('Error retrieving access token:', error.response.data);
//     res.status(500).json({ error: 'Failed to retrieve access token' });
//   }
// })

app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });

  app.get('/photos', (req, res) => {
    const folderPath = path.join(__dirname, '../../frontend/images');
  
    fs.readdir(folderPath, (err, files) => {
      if (err) {
        console.log(err.message);
        return res.status(500).json({ error: 'Unable to scan directory' });
      }

      res.json(files);
    });
  });
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

// async function getAccessToken() : Promise<string> {
//   const client =  process.env.AUTH_KEY as string;
//   const secret = process.env.AUTH_SECRET as string;

//   const data = qs.stringify({
//     grant_type: 'client_credentials',
//     client_id: client,
//     client_secret: secret,
//     scope: 'AdobeID,openid,read_organizations,adobeio_api,additional_info.roles,read_client_secret,manage_client_secrets,lr_partner_apis,lr_partner_rendition_apis',

//   });

//   const config = {
//     method: 'post',
//     url: 'https://ims-na1.adobelogin.com/ims/token/v3',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     data: data,
//   }

//   const response = await axios.request(config);
//   return response.data;
// }

// async function getData() {
//   const request = await getAccessToken();
//   const tokenDict = qs.parse(request);
//   const token = tokenDict.access_token;
//   const client =  process.env.LIGHTROOM_KEY as string;

//   const response = await axios.get('https://lr.adobe.io/v2/catalog', {
//     headers: {
//       'X-API-Key': client,
//       'Authorization': `Bearer ${token}`
//     }
//   })
//   console.log(response);
//   return response;
// }

// getData();