const assert = require('assert');
const Logger = require('../Logging/Logger');
const BusboyStreamReaderToUploadTrack = require('./BusboyStreamReaderToUploadTrack');
const BusboyStreamReaderToValidateTrack = require('./BusboyStreamReaderToValidateTrack');

module.exports = class BusboyActionsFactory {
  /**
   * @param {import('../FileActions/ITrackParser')} trackParser
   * @param {import('../FileActions/TrackFieldsValidator')} trackFieldsValidator
   * @param {import('../FileActions/TrackPresenceValidator')} trackPresenceValidator
   * @param {import('../FileActions/ReversibleActionsFactory')} reversibleActionsFactory
   */
  constructor (trackParser, trackFieldsValidator, trackPresenceValidator, reversibleActionsFactory) {
    assert.ok(trackParser); this._trackParser = trackParser;
    assert.ok(trackFieldsValidator); this._trackFieldsValidator = trackFieldsValidator;
    assert.ok(trackPresenceValidator); this._trackPresenceValidator = trackPresenceValidator;
    assert.ok(reversibleActionsFactory); this._reversibleActionsFactory = reversibleActionsFactory;
  }

  createStreamReaderToUploadTrack () {
    return new BusboyStreamReaderToUploadTrack(this._trackParser, this._reversibleActionsFactory, new Logger());
  }

  createStreamReaderToValidateTrack () {
    return new BusboyStreamReaderToValidateTrack(this._trackParser, this._trackFieldsValidator, this._trackPresenceValidator, new Logger());
  }
};
