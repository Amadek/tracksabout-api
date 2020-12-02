const assert = require('assert');
const mm = require('music-metadata');
const util = require('util');

module.exports = class TrackParser {
  parse (readTrackStream, mimeType) {
    console.log(`TrackParser - parsing begins. mimeType = ${mimeType}`);
    assert.ok(readTrackStream);
    assert.ok(mimeType);

    return Promise.resolve()
      .then(() => mm.parseStream(readTrackStream, { mimeType }))
      .then(metadata => {
        console.log(util.inspect(metadata, { showHidden: false, depth: null }));
        console.log('TrackParser - parsing ends.');

        return {
          artist: metadata.common.artist,
          title: metadata.common.title,
          album: metadata.common.album,
          year: metadata.common.year,
          mimeType: mimeType
        };
      });
  }
};
