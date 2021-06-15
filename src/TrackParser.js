const assert = require('assert');
const mm = require('music-metadata');
const ITrackParser = require('./ITrackParser');

module.exports = class TrackParser extends ITrackParser {
  /**
   * @param {import('./Controllers/Logger')} logger
   */
  constructor (logger) {
    super();
    assert.ok(logger);
    this._logger = logger;
  }

  parse (fileStream, mimetype) {
    assert.ok(fileStream);
    this._logger.log(this, `Parsing begins, mimeType = ${mimetype}`);

    return Promise.resolve()
      .then(() => mm.parseStream(fileStream, { mimeType: mimetype }))
      .then(metadata => {
        const parsedTrack = {
          artistName: metadata.common.artist,
          title: metadata.common.title,
          albumName: metadata.common.album,
          year: metadata.common.year,
          mimetype: mimetype
        };

        this._logger.log(this, 'Parsing ends: \n' + JSON.stringify(parsedTrack, null, 2));
        return parsedTrack;
      });
  }
};
