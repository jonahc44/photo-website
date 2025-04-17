import  express  from 'express'
import axios from 'axios'
import qs from 'qs'
import dotenv from 'dotenv'
import cors from 'cors'
dotenv.config()

interface TokenResponse {
    access_token: string
}
const app = express()
const PORT = 5000

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

async function getAccessToken() : Promise<string> {
  const id =  process.env.LIGHTROOM_ID as string
  const secret = process.env.LIGHTROOM_SECRET as string
  const response = await axios.post<TokenResponse>(
    'https://ims-na1.adobelogin.com/ims/token/v3',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: id,
        client_secret: secret,
        scope: 'openid AdobeID read_organizations',
      }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

getAccessToken()
// const endpoint = 'https://lr.adobe.io/v2/catalog/'

// console.log(accessToken)