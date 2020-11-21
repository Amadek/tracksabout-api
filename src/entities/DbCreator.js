const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongodb = require('mongodb');
const GridFsBucket = mongodb.GridFSBucket;
const ObjectID = mongodb.ObjectID;
const artists = require('../resources/artists.json');

module.exports = class DbCreator {
  constructor (db) {
    assert.ok(db);
    this._db = db;
  }

  create () {
    console.log('DbCreator.create() started.');

    return Promise.resolve()
      .then(() => this._uploadTracks())
      .then(() => this._db.collection('artists').deleteMany({}))
      .then(() => this._db.collection('artists').insertMany(artists))
      .then(() => console.log("DbCreator.create() completed."))
      .then(() => this._db);
  }

  _uploadTracks () {
    const tracks = artists.map(a => a.albums.map(a => a.tracks)).flat(2);
    const uploadTrackPromises = [];

    for (const track of tracks) {
      const uploadTrackPromise = Promise.resolve()
        .then(() => this._uploadTrack(path.resolve('src/resources/fake.wav')))
        .then(fileId => track.fileId = fileId);

      uploadTrackPromises.push(uploadTrackPromise);
    }

    return Promise.all(uploadTrackPromises);
  }

  /**
   * Uploads file to mongo and returns fileId in promise.
   * @param {string} trackPath 
   * @param {string} trackFileName 
   */
  _uploadTrack (trackPath) {
    const gridFsBucket = new GridFsBucket(this._db, { chunkSizeBytes: 1024, bucketName: 'tracks' });
    const trackFileName = new ObjectID().toHexString() + path.extname(trackPath);

    return new Promise((resolve, reject) => {
      gridFsBucket.drop(() => {
        const readStream = fs.createReadStream(trackPath).pipe(gridFsBucket.openUploadStream(trackFileName));
        readStream
          .on('error', error => reject(error))
          .on('finish', () => {
            console.log(`File ${readStream.id} uploaded`);
            resolve(readStream.id);
          });
      });
    });
  }
}

// Script to join artists and track files
// db.artists.aggregate([
//   { $unwind: "$albums" }, { $unwind: "$albums.tracks" },
//   {
//     $lookup:
//     {
//       from: 'tracks.files',
//       localField: 'albums.tracks.fileId',
//       foreignField: '_id',
//       as: 'albums.tracksWithFiles'
//     }
//   },
//   { $unwind: '$albums.tracksWithFiles' }
// ]).pretty()