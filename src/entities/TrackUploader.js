const assert = require('assert');
const { GridFSBucket, ObjectID } = require('mongodb');

module.exports = class TrackUploader {
  constructor (db) {
    assert.ok(db);
    this._db = db;
    this._bucket = new GridFSBucket(this._db, { chunkSizeBytes: 1024, bucketName: 'tracks' });
  }

  upload (parsedTrack) {
    console.log('TrackUploader - Upload begins.');
    assert.ok(parsedTrack);

    const trackMetadata = this._getTrackMetadata(parsedTrack);
    return this._uploadTrack(parsedTrack.fileStream, trackMetadata);
  }

  _getTrackMetadata (parsedTrack) {
    return {
      artistName: parsedTrack.artistName,
      title: parsedTrack.title,
      albumName: parsedTrack.albumName,
      year: parsedTrack.year,
      mimeType: parsedTrack.mimetype
    };
  }

  _uploadTrack (trackStream, trackMetadata) {
    const trackFileName = new ObjectID().toHexString();
    const uploadTrackStream = this._bucket.openUploadStream(trackFileName, { metadata: trackMetadata });

    return new Promise((resolve, reject) => {
      uploadTrackStream
        .on('finish', () => {
          const uploadedTrack = trackMetadata;
          uploadedTrack.id = uploadTrackStream.id;
          console.log(`TrackUploader - Upload ends. File ${uploadedTrack.id} uploaded to mongo.`);
          resolve(uploadedTrack);
        })
        .on('error', err => reject(err));

      trackStream.pipe(uploadTrackStream);
    });
  }
};
