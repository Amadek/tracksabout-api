const assert = require('assert');
const { Conflict, BadRequest } = require('http-errors');
const BusboyStreamReader = require('./BusboyStreamReader');
const { PassThrough } = require('stream');

module.exports = class BusboyStreamReaderToUploadTrack extends BusboyStreamReader {
  /**
   * @param {import('../ITrackParser')} trackParser
   * @param {import('../FileLifetimeActions/FileLifetimeActionsFactory')} fileLifetimeActionsFactory
   * @param {import('./Logger')} logger
   */
  constructor (trackParser, fileLifetimeActionsFactory, logger) {
    super(logger);
    assert.ok(trackParser); this._trackParser = trackParser;
    assert.ok(fileLifetimeActionsFactory); this._fileLifetimeActionsFactory = fileLifetimeActionsFactory;

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
    const artistHierarchyUpdater = this._fileLifetimeActionsFactory.createArtistHierarchyUpdater();
    const trackUploader = this._fileLifetimeActionsFactory.createTrackUploader();

    this._updateArtistQueue = this._updateArtistQueue.then(() => artistHierarchyUpdater.update(parsedTrack));
    const updateArtistResult = await this._updateArtistQueue;
    if (!updateArtistResult.updated) throw new Conflict(updateArtistResult.message);
    this.addActionToUndo(artistHierarchyUpdater);

    this.addActionToUndo(trackUploader);
    const uploadedTrack = await trackUploader.upload(parsedTrack, streamToUploadTrack, this);

    return uploadedTrack.fileId;
  }
};
