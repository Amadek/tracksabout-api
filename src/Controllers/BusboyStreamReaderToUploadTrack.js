const assert = require('assert');
const { Conflict } = require('http-errors');
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
    // TODO generalnie działa, trzeba jeszcze posprawdzać w przypadku błędów, może stream.pipe będzie też działał?
    // Jeżeli coś dziwnego dzieje się z odtwarzanym utworem i nie jest on w pełni zauplodowany (dobrze by było jakieś sumy kontrolne sprawdzać)
    // to tutaj najpewniej będzie tkwił problem.
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

    const parsedTrack = await this._trackParser.parse(streamToParseTrack, mimetype);
    const updateArtistResult = await this._artistHierarchyUpdater.update(parsedTrack);
    if (!updateArtistResult.updated) throw new Conflict(updateArtistResult.message);
    const uploadedTrack = await this._trackUploader.upload(parsedTrack, streamToUploadTrack, this);

    return uploadedTrack.fileId;
  }
};
