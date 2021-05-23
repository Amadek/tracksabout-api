const { ObjectID } = require('mongodb');
const ITrackParser = require('../src/entities/ITrackParser');

/**
 * We need to mock TrackParser because we cannot create unique file with metadata every time when test starts.
 */
module.exports = class TrackParserTest extends ITrackParser {
  constructor (trackBaseData) {
    super();
    this._trackBaseData = trackBaseData;
  }

  parse (_fileStream, _mimetype) {
    return {
      artistName: this._trackBaseData?.artistName ?? new ObjectID().toHexString(),
      title: this._trackBaseData?.title ?? new ObjectID().toHexString(),
      albumName: this._trackBaseData?.albumName ?? new ObjectID().toHexString(),
      year: 1998,
      mimetype: 'audio/flac'
    };
  }
};
