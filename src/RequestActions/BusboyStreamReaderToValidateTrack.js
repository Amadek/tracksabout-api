const assert = require('assert');
const BusboyStreamReader = require('./BusboyStreamReader');
const { Conflict, BadRequest } = require('http-errors');
const ITrackParser = require('../FileActions/ITrackParser');
const TrackPresenceValidator = require('../FileActions/TrackPresenceValidator');
const TrackFieldsValidator = require('../FileActions/TrackFieldsValidator');
const { PassThrough } = require('stream');

module.exports = class BusboyStreamReaderToValidateTrack extends BusboyStreamReader {
  /**
   * @param {ITrackParser} trackParser
   * @param {TrackFieldsValidator} trackFieldsValidator
   * @param {TrackPresenceValidator} trackPresenceValidator
   */
  constructor (trackParser, trackFieldsValidator, trackPresenceValidator, logger) {
    super(logger);
    assert.ok(trackParser instanceof ITrackParser); this._trackParser = trackParser;
    assert.ok(trackFieldsValidator instanceof TrackFieldsValidator); this._trackFieldsValidator = trackFieldsValidator;
    assert.ok(trackPresenceValidator instanceof TrackPresenceValidator); this._trackPresenceValidator = trackPresenceValidator;
  }

  async readFileStream (fileStream, filename, mimetype) {
    super.readFileStream(fileStream, filename, mimetype);

    const streamToParseTrack = new PassThrough();
    const streamToGetCover = new PassThrough();

    fileStream.on('data', chunk => {
      streamToParseTrack.push(chunk);
      streamToGetCover.push(chunk);
    });
    fileStream.on('end', () => {
      streamToParseTrack.push(null);
      streamToGetCover.push(null);
    });
    fileStream.on('error', err => {
      streamToParseTrack.emit('error', err);
      streamToGetCover.emit('error', err);
    });

    const parsedTrack = await this._trackParser.parse(streamToParseTrack, mimetype);
    const albumCover = await this._trackParser.getCover(streamToGetCover, mimetype);
    parsedTrack.albumCover = albumCover;

    const trackFieldsValidationResult = this._trackFieldsValidator.validate(parsedTrack, albumCover);
    if (!trackFieldsValidationResult.result) {
      const badRequestError = new BadRequest(trackFieldsValidationResult.message);
      badRequestError.additionalData = { parsedTrack };
      throw badRequestError;
    }

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
