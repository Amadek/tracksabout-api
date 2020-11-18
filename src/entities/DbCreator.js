const assert = require('assert');
const fs = require('fs');
const path = require('path');
const homedir = require('os').homedir();
const GridFsBucket = require('mongodb').GridFSBucket;

module.exports = class DbCreator {
  static artists = [
    {
      name: 'Yes',
      albums: [
        { name: 'The Yes Album' },
        { name: 'Close To The Edge' }
      ]
    },
    {
      name: 'Queen',
      albums: [
        { name: 'The Miracle' }
      ]
    }
  ];

  constructor (db) {
    assert.ok(db);
    this._db = db;
  }

  create () {
    return Promise.resolve()
      .then(() => console.log('DbCreator.create() started.'))
      .then(() => this._db.collection('artists').deleteMany({}))
      .then(() => this._db.collection('artists').insertMany(DbCreator.artists))
      .then(() => this._uploadTrack(path.join(homedir, 'jk.wav'))) // IT WORKS BUT IT'S SLOW :(
      .then(() => console.log('DbCreator.create() completed.'))
      .then(() => this._db);
  }

  _uploadTrack (trackPath) {
    const gridFsBucket = new GridFsBucket(this._db, { chunkSizeBytes: 1024, bucketName: 'tracks' });

    return new Promise((resolve, reject) => {
      gridFsBucket.drop(() => {
        fs.createReadStream(trackPath)
          .pipe(gridFsBucket.openUploadStream(path.basename(trackPath)))
          .on('error', error => reject(error))
          .on('finish', () => resolve());
      });
    });
  }
}