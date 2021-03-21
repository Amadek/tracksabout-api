const assert = require('assert');
const { GridFSBucket, ObjectID } = require('mongodb');

module.exports = class TrackUploader {
  constructor (db, logger) {
    assert.ok(db);
    assert.ok(logger);
    this._db = db;
    this._logger = logger;
    this._bucket = new GridFSBucket(this._db, { chunkSizeBytes: 1024, bucketName: 'tracks' });
  }

  upload (parsedTrack, trackStream) {
    this._logger.log(this, 'Upload begins.');
    assert.ok(parsedTrack);
    assert.ok(trackStream);

    const trackMetadata = this._getTrackMetadata(parsedTrack);
    return this._uploadTrack(trackStream, trackMetadata);
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
          this._logger.log(this, `Upload ends. File ${uploadedTrack.id} uploaded to mongo.`);
          resolve(uploadedTrack);
        })
        .on('error', err => reject(err));

      trackStream.pipe(uploadTrackStream);
    });
  }
};
