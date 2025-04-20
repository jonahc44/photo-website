import express  from 'express'
import axios from 'axios'
import qs from 'qs'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
dotenv.config()

const app = express();
const PORT = 5000;

app.use(cors());
app.use('/photos', express.static(path.join(__dirname, 'public/photos'), {
  setHeaders: function(res, path) {
    res.set("Content-Security-Policy", "default-srd 'self'")
  }
}));

app.get('/photos', (req, res) => {
  const folderPath = path.join(__dirname, 'public/photos');

  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.log(err.message);
      return res.status(500).json({ error: 'Unable to scan directory' });
    }

    const photoUrls = files.map(file => `${req.protocol}://${req.get('host')}/photos/${file}`);
    res.json(photoUrls);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});