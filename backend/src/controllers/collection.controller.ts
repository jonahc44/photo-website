import { Request, Response } from 'express';
import { db } from '../server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAssets } from '../adobe_utils/GetAssets';
import { fetchRenditions } from '../adobe_utils/GetRenditions';

export const getCollections = async (req: Request, res: Response) => {
  try {
    const collFetch = await db.collection('photo_metadata').doc('collections').get();
    const collections = collFetch.exists ? collFetch.data() : {};
    
    res.status(200).json(collections);
  } catch (error) {
    res.status(500).send('Error fetching collections');
  }
};

export const addCollection = async (req: Request<{collectionId: string;}>, res: Response) => {
    const key = req.params.collectionId;
    const collFetch = await db.collection('photo_metadata').doc('collections').get();
    const collections = collFetch.exists ? collFetch.data() : {};

    if (typeof collections === 'object') {
        if (key in collections) {
            res.status(400).send('Cannot create duplicate collection');
            return;
        }

        const numColl = Object.values(collections).length - 1;
        collections[key] = {
            album: '',
            selected: false,
            num_photos: 0,
            index: numColl
        }

        await db.collection('photo_metadata').doc('collections').set({
            [key]: collections[key]
        }, { merge: true });
        res.status(201).json(collections);
    } else {
        console.error('Unexpected error occured when accessing collections metadata');
    }
}

export const deleteCollection = async (req: Request<{collectionId: string;}>, res: Response) => {
    const key = req.params.collectionId;
    const collFetch = await db.collection('photo_metadata').doc('collections').get();
    const collections = collFetch.exists ? collFetch.data() : {};

    if (typeof collections === 'object') {
        if (!(key in collections)) {
            res.status(400).send('Cannot delete collection that does not exist');
            return;
        }

        await db.collection('photo_metadata').doc('collections').update({
            [key]: FieldValue.delete()
        })

        if (collections[key].album != '' && collections[key].selected) {
            await db.collection('photo_metadata').doc('albums').update({
                [`${collections[key].album}.selected`]: FieldValue.increment(-1)
            })
        }

        res.json(collections);
    } else {
        console.error('Unexpected error occured when accessing collections metadata');
    }
}

export const updateCollection = async (req: Request<{collectionId: string;}>, res: Response) => {
    const token = res.locals.adobeToken;
    const key = req.params.collectionId;
    const collFetch = await db.collection('photo_metadata').doc('collections').get();
    const collections = collFetch.exists ? collFetch.data() : {};
    console.log(`Changing collection ${key}`)

    if (typeof collections === 'object') {
        if (!(key in collections)) {
            res.status(400).send('Cannot add new album');
            return;
        }

        console.log(collections[key].selected);
        collections[key].selected = !collections[key].selected;

        await db.collection(`photo_metadata`).doc('collections').update({
            [key]: collections[key]
        });
        
        if (collections[key].album != '') {
            await getAssets(token);
            await fetchRenditions(token, collections[key].album, '');

            await db.collection('photo_metadata').doc('albums').update({
            [`${collections[key].album}.selected`]: FieldValue.increment(collections[key].selected ? 1 : -1)
            })
        }
        
        console.log('Successfully altered albums');
        res.json(collections);
    } else {
        console.error('Unexpected error occured when accessing albums metadata');
    }
}

export const reorderCollections = async (req: Request, res: Response) => {
    const arr = req.body;
    const updateObj: { [key: string]: number } = {};
    for (let i = 0; i < arr.length; i++) {
        const coll = arr[i];
        updateObj[`${coll.name}.index`] = coll.index;
    }
    await db.collection('photo_metadata').doc('collections').update(updateObj);
    return res.sendStatus(204);
}

export const updateCollectionThumbnail = async (req: Request<{collectionId: string;} & {thumbnailAsset: string;}>, res: Response) => {
  const collectionId = req.params.collectionId;
  const thumbnail = req.params.thumbnailAsset;

  try {
    const collectionsFetch = await db.collection('photo_metadata').doc('collections').get();
    const collections = collectionsFetch.data();

    if (typeof collections !== 'object' || !(collectionId in collections)) {
      return res.status(404).send('Collection does not exist');
    }

    if (collections[collectionId].thumbnail !== thumbnail) {
      collections[collectionId].thumbnail = thumbnail;
      const albumsFetch = await db.collection('photo_metadata').doc('albums').get();
      const albums = albumsFetch.data();
      
      if (typeof albums === 'object') {
        const album = collections[collectionId].album;
        collections[collectionId].thumbnailUrl = albums[album].photos[thumbnail].thumbnail;
      }
    } else {
      collections[collectionId].thumbnail = '';
      collections[collectionId].thumbnailUrl = '';
    }

    await db.collection('photo_metadata').doc('collections').update({
      [collectionId]: collections[collectionId]
    });

    return res.status(200).json(collections);
  } catch (error) {
    console.error('Unexpected error occurred when updating thumbnail:', error);
    return res.status(500).send('Internal Server Error');
  }
};