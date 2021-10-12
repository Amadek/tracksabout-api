const assert = require('assert');
const { ObjectId } = require('mongodb');
const IReversibleAction = require('./IReversibleAction');

module.exports = class ArtistHierarchyUpdater extends IReversibleAction {
  /**
   * @param {*} dbClient
   * @param {import('../Logging/Logger')} logger
   */
  constructor (dbClient, logger) {
    super();
    assert.ok(dbClient);
    assert.ok(logger);
    this._dbClient = dbClient;
    this._logger = logger;
    this._insertedArtist = null;
    this._insertedAlbum = null;
    this._insertedTrack = null;
  }

  async undo () {
    this._logger.log(this, 'Rollbacking changes...\n' + JSON.stringify({
      '_insertedArtist._id': this._insertedArtist._id,
      '_insertedAlbum._id': this._insertedAlbum._id,
      '_insertedTrack._id': this._insertedTrack._id
    }, null, 2));

    if (this._insertedArtist) {
      const deletedTrackResult = await this._dbClient.db().collection('artists').deleteOne({ _id: this._insertedArtist._id });
      this._logger.log(this, 'Rollback insert artist result:\n' + JSON.stringify(deletedTrackResult, null, 2));
      return;
    }

    if (this._insertedAlbum) {
      const deletedAlbumResult = await this._dbClient.db().collection('artists').updateOne({}, { $pull: { albums: { _id: this._insertedAlbum._id } } });
      this._logger.log(this, 'Rollback insert album result:\n' + JSON.stringify(deletedAlbumResult, null, 2));
      return;
    }

    if (this._insertedTrack) {
      const deletedTrackResult = await this._dbClient.db().collection('artists').updateOne({}, { $pull: { albums: { tracks: { _id: this._insertedTrack._id } } } });
      this._logger.log(this, 'Rollback insert track result:\n' + JSON.stringify(deletedTrackResult, null, 2));
    }
  }

  /**
   * @async
   * @returns {Promise<{updated: boolean, message: string?, updatedArtist: object|null}>}
   */
  async update (parsedTrack) {
    this._logger.log(this, 'Check artist hierarchy started.');

    const db = this._dbClient.db();
    const artistsCount = await db.collection('artists').countDocuments({ name: parsedTrack.artistName });

    let artist = null;

    if (artistsCount === 0) {
      artist = await db.collection('artists')
        .insertOne(this._createArtist(parsedTrack))
        .then(({ insertedId }) => db.collection('artists').findOne({ _id: insertedId }));
      this._insertedArtist = artist;
    } else {
      artist = await db.collection('artists').findOne({ name: parsedTrack.artistName });
    }

    let artistAlbum = artist.albums.find(a => a.name === parsedTrack.albumName);

    if (!artistAlbum) {
      artistAlbum = this._createAlbum(parsedTrack);
      artist.albums.push(artistAlbum);
      this._insertedAlbum = artistAlbum;
    }

    if (artistAlbum.tracks.find(t => t.title === parsedTrack.title)) {
      this._logger.log(this, `Track with specified title ${artist.name} -> ${artistAlbum.name} -> ${parsedTrack.title} already exists, ending.`);
      return { updated: false, message: 'Track with specified title already exists!', updatedArtist: null };
    }

    parsedTrack._id = new ObjectId();
    artistAlbum.tracks.push(parsedTrack);
    this._insertedTrack = parsedTrack;
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
      _id: new ObjectId(),
      name: uploadedTrack.albumName,
      year: uploadedTrack.year,
      tracks: []
    };
  }
};
