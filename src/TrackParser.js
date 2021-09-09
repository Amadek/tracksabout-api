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
        this._logger.log(this, 'Parsing information from track: \n' + JSON.stringify(metadata, null, 2));

        const parsedTrack = {
          number: metadata.common.track.no,
          title: metadata.common.title,
          albumName: metadata.common.album,
          artistName: metadata.common.artist,
          year: metadata.common.year,
          mimetype: mimetype
        };

        this._logger.log(this, 'Parsing ends, parsed track: \n' + JSON.stringify(parsedTrack, null, 2));
        return parsedTrack;
      });
  }
};
