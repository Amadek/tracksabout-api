const assert = require('assert');
const { Conflict, BadRequest } = require('http-errors');
const BusboyStreamReader = require('./BusboyStreamReader');
const { PassThrough } = require('stream');

module.exports = class BusboyStreamReaderToUploadTrack extends BusboyStreamReader {
  /**
   * @param {import('../ITrackParser')} trackParser
   * @param {import('../ArtistHierarchyUpdater')} artistHierarchyUpdater
   * @param {import('../TrackUploader')} trackUploader
   * @param {import('./Logger')} logger
   */
  constructor (trackParser, artistHierarchyUpdater, trackUploader, logger) {
    super(logger);
    assert.ok(trackParser); this._trackParser = trackParser;
    assert.ok(artistHierarchyUpdater); this._artistHierarchyUpdater = artistHierarchyUpdater;
    assert.ok(trackUploader); this._trackUploader = trackUploader;
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

    const updateArtistResult = await this._artistHierarchyUpdater.update(parsedTrack);
    if (!updateArtistResult.updated) throw new Conflict(updateArtistResult.message);
    this._trackUploader.prepare(parsedTrack, streamToUploadTrack, this);
    const uploadedTrack = await this._trackUploader.redo();

    return uploadedTrack.fileId;
  }
};
