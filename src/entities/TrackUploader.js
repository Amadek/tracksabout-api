const assert = require('assert');
const { GridFSBucket, ObjectID } = require('mongodb');

module.exports = class TrackUploader {
  constructor (db) {
    assert.ok(db);
    this._db = db;
    this._bucket = new GridFSBucket(this._db, { chunkSizeBytes: 1024, bucketName: 'tracks' });
  }

  upload (readTrackStream, track) {
    console.log('TrackUploader - Upload begins.');
    assert.ok(readTrackStream);
    assert.ok(track);

    const trackFileName = new ObjectID().toHexString();
    const uploadTrackStream = this._bucket.openUploadStream(trackFileName);

    return new Promise((resolve, reject) => {
      uploadTrackStream
        .on('finish', () => {
          track.fileId = uploadTrackStream.id;
          console.log(`TrackUploader - Upload ends. File ${uploadTrackStream.id} uploaded to mongo.`);
          resolve(track.fileId);
        })
        .on('error', err => reject(err));

      readTrackStream.pipe(uploadTrackStream);
    });
  }
};
