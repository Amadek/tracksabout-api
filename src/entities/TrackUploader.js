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
    const uploadTrackStream = this._bucket.openUploadStream(trackFileName, { metadata: track });

    return new Promise((resolve, reject) => {
      uploadTrackStream
        .on('finish', () => {
          const trackFileId = uploadTrackStream.id;
          console.log(`TrackUploader - Upload ends. File ${trackFileId} uploaded to mongo.`);
          resolve(trackFileId);
        })
        .on('error', err => reject(err));

      readTrackStream.pipe(uploadTrackStream);
    });
  }
};
