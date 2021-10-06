const assert = require('assert');
const BusboyStreamReader = require('./BusboyStreamReader');
const { Conflict } = require('http-errors');

module.exports = class BusboyStreamReaderToValidateTrack extends BusboyStreamReader {
  /**
   * @param {import('../ITrackParser')} trackParser
   * @param {import('../TrackPresenceValidator')} trackPresenceValidator
   */
  constructor (trackParser, trackPresenceValidator, logger) {
    super(logger);
    assert.ok(trackParser); this._trackParser = trackParser;
    assert.ok(trackPresenceValidator); this._trackPresenceValidator = trackPresenceValidator;
  }

  async readFileStream (fileStream, filename, mimetype) {
    super.readFileStream(fileStream, filename, mimetype);

    const parsedTrack = await this._trackParser.parse(fileStream, mimetype);
    const trackExists = await this._trackPresenceValidator.validate(parsedTrack);

    if (trackExists) {
      const confilctError = new Conflict('Track already exists!');
      confilctError.additionalData = { parsedTrack };
      throw confilctError;
    }

    fileStream.resume();
    return parsedTrack;
  }
};
