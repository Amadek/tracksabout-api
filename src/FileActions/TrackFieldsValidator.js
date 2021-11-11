const assert = require('assert');
const Logger = require('../Logging/Logger');

module.exports = class TrackFieldsValidator {
  /**
   * @param {Logger} logger
   */
  constructor (logger) {
    assert.ok(logger instanceof Logger); this._logger = logger;
  }

  validate (track, albumCover) {
    assert.ok(track);
    assert.ok(albumCover || true);

    if (!this._validateStandardFields(track)) {
      this._logger.log(this, 'Validation standard track fields failed for track ' + track.title);
      return {
        result: false,
        message: 'Not all required track fields are provided (track number, title, duration, album name, artist name, year and mimetype).'
      };
    }

    if (!albumCover) {
      this._logger.log(this, `Track ${track.title} has not got album required cover.`);
      return { result: false, message: 'No album cover provided.' };
    }

    this._logger.log(this, 'Validation success.');
    return { result: true };
  }

  _validateStandardFields (track) {
    return !isNaN(track.number) &&
    track.title &&
    track.duration &&
    track.albumName &&
    track.artistName &&
    !isNaN(track.year) &&
    track.mimetype;
  }
};
