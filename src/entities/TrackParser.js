const assert = require('assert');
const mm = require('music-metadata');

module.exports = class TrackParser {
  parse (fileStream, mimetype) {
    assert.ok(fileStream);
    console.log(`TrackParser - parsing begins. mimeType = ${mimetype}`);

    return Promise.resolve()
      .then(() => mm.parseStream(fileStream, { mimeType: mimetype }))
      .then(metadata => {
        console.debug(metadata);
        console.log('TrackParser - parsing ends.');
        const parsedTrack = {
          artistName: metadata.common.artist,
          title: metadata.common.title,
          albumName: metadata.common.album,
          year: metadata.common.year,
          mimetype: mimetype,
          fileStream: fileStream
        };

        return parsedTrack;
      });
  }
};
