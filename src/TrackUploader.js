const assert = require('assert');
const { GridFSBucket, ObjectId } = require('mongodb');
const UndoRedo = require('./UndoRedo');

module.exports = class TrackUploader extends UndoRedo {
  /**
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('./Controllers/Logger')} logger
   */
  constructor (dbClient, logger) {
    super();
    assert.ok(dbClient);
    assert.ok(logger);
    this._dbClient = dbClient;
    this._logger = logger;
    this._bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes: 1024, bucketName: 'tracks' });
  }

  prepare (parsedTrack, trackStream, streamReader) {
    assert.ok(parsedTrack); this._parsedTrack = parsedTrack;
    assert.ok(trackStream); this._trackStream = trackStream;
    assert.ok(streamReader); this._streamReader = streamReader;
  }

  async undo () {
    this._logger.log(this, 'Rollbacking changes...');

    const updateTrackFileIdResult = await this._dbClient.db().collection('artists').updateMany(
      {},
      { $set: { 'albums.$[].tracks.$[track].fileId': null } },
      { arrayFilters: [{ 'track._id': this._parsedTrack._id }] }
    );
    this._logger.log(this, 'Rollback update track file id result:\n' + JSON.stringify(updateTrackFileIdResult, null, 2));

    const deleteTrackFileResult = await this._bucket.delete(this._uploadedTrackFileId);
    this._logger.log(this, 'Rollback upload track file:\n' + JSON.stringify(deleteTrackFileResult, null, 2));
  }

  async redo () {
    this._logger.log(this, 'Upload begins.');

    this._logger.log(this, 'ParsedTrack:\n' + JSON.stringify(this._parsedTrack, null, 2));

    const trackMetadata = this._getTrackMetadata(this._parsedTrack);
    this._uploadedTrackFileId = await this._uploadTrack(this._trackStream, trackMetadata, this._streamReader);

    // https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/
    const updateTrackFileIdResult = await this._dbClient.db().collection('artists').updateMany(
      {},
      { $set: { 'albums.$[].tracks.$[track].fileId': this._uploadedTrackFileId } },
      { arrayFilters: [{ 'track._id': this._parsedTrack._id }] }
    );

    this._logger.log(this, 'Update track file id result:\n' + JSON.stringify(updateTrackFileIdResult, null, 2));

    const findTrackResult = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $unwind: '$albums.tracks' },
      { $match: { 'albums.tracks._id': this._parsedTrack._id } },
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

  _uploadTrack (trackStream, trackMetadata, streamReader) {
    const trackFileName = new ObjectId().toHexString();
    const uploadTrackStream = streamReader.addHandlingStream(this._bucket.openUploadStream(trackFileName, { metadata: trackMetadata }));

    return new Promise((resolve, reject) => {
      uploadTrackStream
        .on('finish', () => {
          const uploadedTrackFileId = uploadTrackStream.id;
          this._logger.log(this, `Upload ends. Track with fileId = ${uploadedTrackFileId} uploaded to mongo.`);
          this._logger.log(this, `Track metadata:\n${JSON.stringify(trackMetadata, null, 2)}`);
          resolve(uploadedTrackFileId);
        })
        .on('error', err => reject(err));

      trackStream.pipe(uploadTrackStream);
    });
  }
};
