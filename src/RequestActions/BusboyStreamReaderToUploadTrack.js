const assert = require('assert');
const { Conflict, BadRequest } = require('http-errors');
const BusboyStreamReader = require('./BusboyStreamReader');
const { PassThrough } = require('stream');
const { ITrackParser } = require('../FileActions');
const ReversibleActionsFactory = require('../FileActions/ReversibleActionsFactory');

module.exports = class BusboyStreamReaderToUploadTrack extends BusboyStreamReader {
  /**
   * @param {ITrackParser} trackParser
   * @param {ReversibleActionsFactory} reversibleActionsFactory
   * @param {number} userId
   * @param {import('../Logging/Logger')} logger
   */
  constructor (trackParser, reversibleActionsFactory, userId, logger) {
    super(logger);
    assert.ok(trackParser instanceof ITrackParser); this._trackParser = trackParser;
    assert.ok(reversibleActionsFactory instanceof ReversibleActionsFactory); this._reversibleActionsFactory = reversibleActionsFactory;
    assert.ok(userId); this._userId = userId;

    this._updateArtistQueue = Promise.resolve({ updated: false, message: null, updatedArtist: null });
  }

  async readFileStream (fileStream, filename, mimetype) {
    super.readFileStream(fileStream, filename, mimetype);

    const streamToParseTrack = this.addHandlingStream(new PassThrough());
    const streamToUploadTrack = this.addHandlingStream(new PassThrough());

    // Method to clone stream for two actions: parsing and uploading.
    // When one stream was used, parsing action consumed some stream and file wasn't uploaded to db in 100% - it was days of debugging and testing...
    fileStream.on('data', chunk => {
      streamToUploadTrack.push(chunk);
      streamToParseTrack.push(chunk);
    });
    fileStream.on('end', () => {
      streamToUploadTrack.push(null);
      streamToParseTrack.push(null);
    });
    fileStream.on('error', err => {
      streamToUploadTrack.emit('error', err);
      streamToParseTrack.emit('error', err);
    });

    let parsedTrack = null;
    try {
      parsedTrack = await this._trackParser.parse(streamToParseTrack, mimetype);
    } catch (error) {
      throw new BadRequest(error.message);
    }
    const artistHierarchyUpdater = this._reversibleActionsFactory.createArtistHierarchyUpdater();
    const trackUploader = this._reversibleActionsFactory.createTrackUploader();

    this._updateArtistQueue = this._updateArtistQueue.then(() => artistHierarchyUpdater.update(parsedTrack, this._userId));
    const updateArtistResult = await this._updateArtistQueue;
    if (!updateArtistResult.updated) throw new Conflict(updateArtistResult.message);
    this.addActionToUndo(artistHierarchyUpdater);

    this.addActionToUndo(trackUploader);
    const uploadedTrack = await trackUploader.upload(parsedTrack, streamToUploadTrack, this);

    return uploadedTrack.fileId;
  }
};
