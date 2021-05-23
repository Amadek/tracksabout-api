const assert = require('assert');
const { Conflict } = require('http-errors');
const BusboyStreamReader = require('./BusboyStreamReader');

module.exports = class BusboyStreamReaderToUploadTrack extends BusboyStreamReader {
  /**
   * @param {import('../entities/ITrackParser')} trackParser
   * @param {import('../entities/ArtistHierarchyUpdater')} artistHierarchyUpdater
   * @param {import('../entities/TrackUploader')} trackUploader
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

    const parsedTrack = await this._trackParser.parse(fileStream, mimetype);
    const updateArtistResult = await this._artistHierarchyUpdater.update(parsedTrack);
    if (!updateArtistResult.updated) throw new Conflict(updateArtistResult.message);
    const uploadedTrack = await this._trackUploader.upload(parsedTrack, fileStream);

    return uploadedTrack.fileId;
  }
};
