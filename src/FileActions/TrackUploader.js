const assert = require('assert');
const { GridFSBucket, ObjectId } = require('mongodb');
const IReversibleAction = require('./IReversibleAction');

module.exports = class TrackUploader extends IReversibleAction {
  /**
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../Logging/Logger')} logger
   */
  constructor (dbClient, logger) {
    super();
    assert.ok(dbClient);
    assert.ok(logger);
    this._dbClient = dbClient;
    this._logger = logger;
    this._bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes: 1024, bucketName: 'tracks' });

    this._uploadedTrackFileId = null;
    this._updatedTrackId = null;
  }

  async undo () {
    this._logger.log(this, 'Rollbacking changes...\n' + JSON.stringify({
      _updatedtrackId: this._updatedTrackId,
      _uploadedTrackFileId: this._uploadedTrackFileId
    }, null, 2));

    if (this._updatedTrackId) {
      const updateTrackFileIdResult = await this._dbClient.db().collection('artists').updateMany(
        {},
        { $set: { 'albums.$[].tracks.$[track].fileId': null } },
        { arrayFilters: [{ 'track._id': this._updatedTrackId }] }
      );
      this._logger.log(this, 'Rollback update track file id result:\n' + JSON.stringify(updateTrackFileIdResult, null, 2));
    }

    if (this._uploadedTrackFileId && await this._bucket.find({ _id: this._uploadedTrackFileId }).count() !== 0) {
      await this._bucket.delete(this._uploadedTrackFileId);
      this._logger.log(this, 'Rollback upload track file finished.');
    }
  }

  async upload (parsedTrack, trackStream, streamReader) {
    assert.ok(parsedTrack);
    assert.ok(trackStream);
    assert.ok(streamReader);

    this._logger.log(this, 'Upload begins.');
    this._logger.log(this, 'ParsedTrack:\n' + JSON.stringify(parsedTrack, null, 2));

    const trackMetadata = this._getTrackMetadata(parsedTrack);
    const uploadedTrackFileId = await this._uploadTrack(trackStream, trackMetadata, streamReader);

    // https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/
    const updateTrackFileIdResult = await this._dbClient.db().collection('artists').updateMany(
      {},
      { $set: { 'albums.$[].tracks.$[track].fileId': uploadedTrackFileId } },
      { arrayFilters: [{ 'track._id': parsedTrack._id }] }
    );

    this._logger.log(this, 'Update track file id result:\n' + JSON.stringify(updateTrackFileIdResult, null, 2));

    const findTrackResult = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $unwind: '$albums.tracks' },
      { $match: { 'albums.tracks._id': parsedTrack._id } },
      { $project: { track: '$albums.tracks' } }
    ]).next();

    this._updatedTrackId = findTrackResult.track._id;
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

  _uploadTrack (trackStream, trackMetadata, streamReader) {
    const trackFileId = new ObjectId();
    const uploadTrackStream = streamReader.addHandlingStream(this._bucket.openUploadStreamWithId(trackFileId, trackFileId.toHexString(), { metadata: trackMetadata }));
    this._uploadedTrackFileId = trackFileId;
    this._logger.log(this, 'Reserved track file id: ' + trackFileId.toHexString());

    return new Promise((resolve, reject) => {
      uploadTrackStream
        .on('finish', () => {
          this._logger.log(this, `Upload ends. Track with fileId = ${trackFileId} uploaded to mongo.`);
          this._logger.log(this, `Track metadata:\n${JSON.stringify(trackMetadata, null, 2)}`);
          resolve(trackFileId);
        })
        .on('error', err => {
          this._logger.log(this, 'Error in GridFS error handler: ' + err.message);
          reject(trackFileId);
        });

      trackStream.pipe(uploadTrackStream);
    });
  }
};
