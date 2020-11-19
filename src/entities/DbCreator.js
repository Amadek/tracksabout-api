const assert = require('assert');
const fs = require('fs');
const path = require('path');
const homedir = require('os').homedir();
const mongodb = require('mongodb');
const GridFsBucket = mongodb.GridFSBucket;
const ObjectID = mongodb.ObjectID;

module.exports = class DbCreator {
  static artists = [
    {
      name: 'Yes',
      albums: [
        {
          name: 'Close to the Edge',
          tracks: [
            { name: 'Close to the Edge' },
            { name: 'And You and I' },
            { name: 'Siberian Khatru' }
          ]
        },
      ]
    }
  ];

  constructor (db) {
    assert.ok(db);
    this._db = db;
  }

  create () {
    console.log('DbCreator.create() started.')

    return Promise.resolve()
      .then(() => this._uploadTrack(path.join(homedir, 'jk.wav')))
      .then(fileId => DbCreator.artists[0].albums[0].tracks[0].fileId = fileId)
      .then(() => this._db.collection('artists').deleteMany({}))
      .then(() => this._db.collection('artists').insertMany(DbCreator.artists))
      .then(() => console.log("DbCreator.create() completed."))
      .then(() => this._db);
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

// Script to join artists and track files (not perfect yet)
// db.artists.aggregate([
//   { $unwind: "$albums" }, { $unwind: "$albums.tracks" },
//   {
//     $lookup:
//     {
//       from: 'tracks.files',
//       localField: 'albums.tracks.fileId',
//       foreignField: '_id',
//       as: 'tracksWithFiles'
//     }
//   },
//   { $unwind: '$tracksWithFiles' }
// ]).pretty()