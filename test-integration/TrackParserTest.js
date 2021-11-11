const { ObjectId } = require('mongodb');
const { ITrackParser } = require('../src/FileActions');

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
      number: Math.floor(Math.random() * 100 + 1),
      title: this._trackBaseData?.title ?? new ObjectId().toHexString(),
      duration: '30',
      albumName: this._trackBaseData?.albumName ?? new ObjectId().toHexString(),
      artistName: this._trackBaseData?.artistName ?? new ObjectId().toHexString(),
      year: 1998,
      mimetype: 'audio/flac'
    };
  }

  getCover (_fileStream, _mimetype) {
    return this._trackBaseData.cover;
  }
};
