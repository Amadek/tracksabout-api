const assert = require('assert');
const { ObjectID } = require('mongodb');

module.exports = class AritstHierarchyUpdater {
  /**
   * @param {any} dbClient
   * @param {import('./Controllers/Logger')} logger
   */
  constructor (dbClient, logger) {
    assert.ok(dbClient);
    assert.ok(logger);
    this._dbClient = dbClient;
    this._logger = logger;
    this._updateArtistQueue = Promise.resolve({ updated: false, message: null, updatedArtist: null });
  }

  /**
   * @async
   * @returns {Promise<{updated: boolean, message: string?, updatedArtist: object|null}>}
   */
  async update (parsedTrack) {
    assert.ok(parsedTrack);
    this._updateArtistQueue = this._updateArtistQueue.then(() => this._update(parsedTrack));
    return await this._updateArtistQueue;
  }

  /**
   * @async
   * @returns {Promise<{updated: boolean, message: string?, updatedArtist: object|null}>}
   */
  async _update (parsedTrack) {
    this._logger.log(this, 'Check artist hierarchy started.');

    const db = this._dbClient.db();
    const artistsCount = await db.collection('artists').countDocuments({ name: parsedTrack.artistName });

    const artist = artistsCount === 0
      ? await db.collection('artists').insertOne(this._createArtist(parsedTrack)).then(({ ops }) => ops[0]) // ops = All the documents inserted using insertOne
      : await db.collection('artists').findOne({ name: parsedTrack.artistName });

    let artistAlbum = artist.albums.find(a => a.name === parsedTrack.albumName);

    if (!artistAlbum) {
      artistAlbum = this._createAlbum(parsedTrack);
      artist.albums.push(artistAlbum);
    }

    if (artistAlbum.tracks.find(t => t.title === parsedTrack.title)) {
      this._logger.log(this, `Track with specified title ${artist.name} -> ${artistAlbum.name} -> ${parsedTrack.title} already exists, ending.`);
      return { updated: false, message: 'Track with specified title already exists!', updatedArtist: null };
    }

    parsedTrack._id = new ObjectID();
    artistAlbum.tracks.push(parsedTrack);
    this._logger.log(this, 'Track not exists yet - updating Artist hierarchy\n' + JSON.stringify(parsedTrack, null, 2));

    await db.collection('artists').updateOne({ name: artist.name }, { $set: artist });

    this._logger.log(this, `artist ${artist._id} ${artist.name} created/updated.`);
    return { updated: true, message: null, updatedArtist: artist };
  }

  _createArtist (parsedTrack) {
    return {
      name: parsedTrack.artistName,
      albums: []
    };
  }

  _createAlbum (uploadedTrack) {
    return {
      _id: new ObjectID(),
      name: uploadedTrack.albumName,
      tracks: []
    };
  }
};
