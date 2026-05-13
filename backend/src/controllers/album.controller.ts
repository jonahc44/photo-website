import { Request, Response } from 'express';
import { db } from '../server';
import { getAlbums } from '../adobe_utils/GetAlbums';
import { getAssets } from '../adobe_utils/GetAssets';
import { fetchRenditions } from '../adobe_utils/GetRenditions';

export const getAlbumsForCollection = async (req: Request<{collectionId: string}>, res: Response) => {
  const token = res.locals.adobeToken;
  const collectionId = req.params.collectionId;

  try {
    const albums = await getAlbums(token);
    await getAssets(token);

    if (typeof albums === 'object') {
      const dataFetch = await db.collection('photo_metadata').doc('collections').get();
      let data = dataFetch.exists ? dataFetch.data() : {};

      if (typeof data === 'object') {
        if (collectionId === 'homepage' && !(collectionId in data)) {
          console.log('Homepage has not been added yet, now adding to collections...');
          await db.collection('photo_metadata').doc('collections').set({
            ['homepage']: {
              'album': '',
              'num_photos': 0
            }
          }, { merge: true });
          
          const newDataFetch = await db.collection('photo_metadata').doc('collections').get();
          data = newDataFetch.data();
        }

        if (typeof data === 'object' && data[collectionId]) {
          albums['selected'] = data[collectionId]['album'];
        }
      }
    }
    
    console.log(`Successfully fetched albums for collection: ${collectionId}`);
    return res.status(200).json(albums);
  } catch (error) {
    console.error('Error fetching albums:', error);
    return res.status(500).send('Internal Server Error');
  }
};

export const associateAlbum = async (req: Request<{albumId: string;} & {collectionId: string;}>, res: Response) => {
  const token = res.locals.adobeToken;
  const albumId = req.params.albumId;
  const collectionId = req.params.collectionId;

  try {
    console.log(`Clicked on album ${albumId} in collection ${collectionId}...`);
    await getAlbums(token);

    const albumsFetch = await db.collection('photo_metadata').doc('albums').get();
    const albums = albumsFetch.data();

    if (typeof albums !== 'object' || !(albumId in albums)) {
      return res.status(400).send('Cannot add new album or album does not exist');
    }

    const currFetch = await db.collection('photo_metadata').doc('collections').get();
    const curr = currFetch.exists ? currFetch.data() : {};

    if (typeof curr === 'object' && curr[collectionId]) {
      const currSel = curr[collectionId]['album'];
      const selected = currSel === albumId;

      if (selected) {
        albums[albumId].collection = '';
      } else {
        albums[albumId].collection = collectionId;
        if (currSel && typeof albums[currSel] === 'object') albums[currSel].collection = '';
      }

      const albumData: any = {
        [albumId]: albums[albumId]
      };
      
      if (currSel && currSel !== albumId && typeof albums[currSel] === 'object') {
        albumData[currSel] = albums[currSel]; 
        albumData[currSel].collection = '';
      }

      await db.collection('photo_metadata').doc('albums').set(albumData, { merge: true });
      await getAssets(token);
      const albumNumPhotos = (await fetchRenditions(token, albumId, '2048')).length;

      await db.collection('photo_metadata').doc('collections').update({
        [collectionId]: {
          ['album']: selected ? '' : albumId,
          ['num_photos']: selected ? 0 : albumNumPhotos
        }
      });
    }

    console.log('Successfully altered albums');
    return res.status(200).json(albums);
  } catch (error) {
    console.error('Unexpected error occurred when accessing albums metadata:', error);
    return res.status(500).send('Internal Server Error');
  }
};

export const getPhotos = async (req: Request<{collectionId: string;}>, res: Response) => {
  const token = res.locals.adobeToken;
  const collectionId = req.params.collectionId;

  try {
    const collectionsFetch = await db.collection('photo_metadata').doc('collections').get();
    const collections = collectionsFetch.data();

    if (typeof collections !== 'object' || !collections[collectionId]) {
      return res.status(404).send('Collection not found');
    }

    const album = collections[collectionId].album;
    if (!album) {
      return res.status(200).json([]);
    }

    const photoUrls = await fetchRenditions(token, album, '2048');
    console.log(`Successfully fetched photos for collection: ${collectionId}`);
    return res.status(200).json(photoUrls);
  } catch (error) {
    console.error('Error fetching photos:', error);
    return res.status(500).send('Internal Server Error');
  }
};

export const reorderPhotos = async (req: Request, res: Response) => {
  const albumId = req.params.albumId;
  const arr = req.body;

  try {
    const updateObj: { [key: string]: number } = {};
    for (let i = 0; i < arr.length; i++) {
      const photo = arr[i];
      const name = photo.href.replace('s/', '_');
      updateObj[`${albumId}.photos.${name}.index`] = photo.index;
    }

    await db.collection('photo_metadata').doc('albums').update(updateObj);
    console.log('Successfully updated order of photos');
    return res.sendStatus(204);
  } catch (error) {
    console.error('Error reordering photos:', error);
    return res.status(500).send('Internal Server Error');
  }
};

export const getThumbnails = async (req: Request<{albumId: string;}>, res: Response) => {
  const token = res.locals.adobeToken;
  const albumId = req.params.albumId;

  try {
    const urls = await fetchRenditions(token, albumId, 'thumbnail2x');
    console.log(`Successfully fetched thumbnails for album: ${albumId}`);
    return res.status(200).json(urls);
  } catch (error) {
    console.error('Error fetching thumbnails:', error);
    return res.status(500).send('Internal Server Error');
  }
};