const assert = require('assert');
const { GridFSBucket, ObjectID } = require('mongodb');

module.exports = class TrackUploader {
  /**
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../controllers/Logger')} logger
   */
  constructor (dbClient, logger) {
    assert.ok(dbClient);
    assert.ok(logger);
    this._dbClient = dbClient;
    this._logger = logger;
    this._bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes: 1024, bucketName: 'tracks' });
  }

  async upload (parsedTrack, trackStream) {
    this._logger.log(this, 'Upload begins.');
    assert.ok(parsedTrack);
    assert.ok(trackStream);

    const trackMetadata = this._getTrackMetadata(parsedTrack);
    const uploadedTrackFileId = await this._uploadTrack(trackStream, trackMetadata);

    // https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/
    const updateTrackFileIdResult = await this._dbClient.db().collection('artists').updateMany(
      {},
      { $set: { 'albums.$[].tracks.$[track].fileId': uploadedTrackFileId } },
      { arrayFilters: [{ 'track._id': parsedTrack._id }] }
    );

    this._logger.log(this, 'Update track file id result:\n' + JSON.stringify(updateTrackFileIdResult.result, null, 2));

    const findTrackResult = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $unwind: '$albums.tracks' },
      { $match: { 'albums.tracks._id': parsedTrack._id } },
      { $project: { track: '$albums.tracks', _id: 0 } }
    ]).next();

    this._logger.log(this, 'Track with updated fileId:\n' + JSON.stringify(findTrackResult.track, null, 2));

    return findTrackResult.track;
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
          const uploadedTrackFileId = uploadTrackStream.id;
          this._logger.log(this, `Upload ends. Track with fileId = ${uploadedTrackFileId} uploaded to mongo.`);
          resolve(uploadedTrackFileId);
        })
        .on('error', err => reject(err));

      trackStream.pipe(uploadTrackStream);
    });
  }
};
