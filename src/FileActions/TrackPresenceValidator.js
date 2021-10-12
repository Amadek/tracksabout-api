const assert = require('assert');

module.exports = class TrackPresenceValidator {
  /**
   * @param {any} dbClient
   * @param {import('../Controllers/Logger')} logger
   */
  constructor (dbClient, logger) {
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(logger); this._logger = logger;
  }

  async validate (parsedTrack) {
    assert.ok(parsedTrack);

    const db = this._dbClient.db();
    const artist = await db.collection('artists').findOne({ name: parsedTrack.artistName });
    if (!artist) {
      this._logger.log(this, `Track's artist ${parsedTrack.artistName} not exists, returning False.`);
      return false;
    }

    const artistAlbum = artist.albums.find(a => a.name === parsedTrack.albumName);
    if (!artistAlbum) {
      this._logger.log(this, `Track's album ${parsedTrack.albumName} not exists in artist ${artist.name}, returning False.`);
      return false;
    }

    const track = artistAlbum.tracks.find(t => t.title === parsedTrack.title);
    if (!track) {
      this._logger.log(this, `Track ${parsedTrack.title} not exists in artist's album ${artistAlbum.name}, returning False.`);
      return false;
    }

    this._logger.log(this, `Track ${track.title} already exists in artist's album, return True.`);
    return true;
  }
};
