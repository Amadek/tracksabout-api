const assert = require('assert');
const { GridFSBucket, ObjectID } = require('mongodb');
const { Readable } = require('stream');

module.exports = class TrackUploader {
  constructor (db) {
    assert.ok(db);
    this._db = db;
    this._bucket = new GridFSBucket(this._db, { chunkSizeBytes: 1024, bucketName: 'tracks' });
  }

  upload (track, trackBuffer) {
    assert.ok(track);
    assert.ok(trackBuffer);

    console.log('TrackUploader.upload() started.');

    return this._createUploadTrackPromise(trackBuffer)
      .then(trackFileId => { track.fileId = trackFileId; })
      .then(console.log('TrackUploader.upload() completed.'));
  }

  _createUploadTrackPromise (trackBuffer) {
    const trackFileName = new ObjectID().toHexString();
    const readTrackStream = new Readable({
      read () {
        this.push(trackBuffer);
        this.push(null); // Indicates EOF.
      }
    });

    return new Promise((resolve, reject) => {
      const uploadTrackStream = readTrackStream
        .pipe(this._bucket.openUploadStream(trackFileName));

      uploadTrackStream
        .on('error', error => reject(error))
        .on('finish', () => {
          console.log(`File ${uploadTrackStream.id} uploaded to mongo.`);
          resolve(uploadTrackStream.id); // returns track file ID.
        });
    });
  }
};
