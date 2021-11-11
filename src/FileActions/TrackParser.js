const assert = require('assert');
const mm = require('music-metadata');
const ITrackParser = require('./ITrackParser');

module.exports = class TrackParser extends ITrackParser {
  /**
   * @param {import('../Logging/Logger')} logger
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
          number: metadata.common.track.no,
          title: metadata.common.title,
          duration: metadata.format.duration,
          albumName: metadata.common.album,
          artistName: metadata.common.artist,
          year: metadata.common.year,
          mimetype: mimetype
        };

        this._logger.log(this, 'Parsing ends, parsed track: \n' + JSON.stringify(parsedTrack, null, 2));
        return parsedTrack;
      });
  }

  async getCover (fileStream, mimetype) {
    assert.ok(fileStream);
    assert.ok(mimetype);

    this._logger.log(this, `Parsing begins for getting track cover, mimeType = ${mimetype}`);
    const metadata = await mm.parseStream(fileStream, { mimeType: mimetype });

    if (!metadata.common.picture || !metadata.common.picture[0]) {
      this._logger.log(this, 'Track cover not found on file.');
      return null;
    }

    assert.ok(metadata.common.picture[0].format);
    assert.ok(metadata.common.picture[0].data);

    this._logger.log(this, 'Track cover found.');
    const cover = metadata.common.picture[0];
    return {
      format: cover.format,
      data: cover.data.toString('base64')
    };
  }
};
