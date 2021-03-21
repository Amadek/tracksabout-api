const assert = require('assert');

module.exports = class AritstHierarchyUpdater {
  constructor (db, logger) {
    assert.ok(db);
    assert.ok(logger);
    this._db = db;
    this._logger = logger;
  }

  update (parsedTrack) {
    assert.ok(parsedTrack);
    this._logger.log(this, 'Check artist hierarchy started.');
    return Promise.resolve()
      .then(() => this._db.collection('artists').countDocuments({ name: parsedTrack.artistName }))
      .then(artistsCount => {
        return artistsCount === 0
          ? this._db.collection('artists').insertOne(this._createArtist(parsedTrack)).then(({ ops }) => ops[0]) // ops = All the documents inserted using insertOne
          : this._db.collection('artists').findOne({ name: parsedTrack.artistName });
      })
      .then(artist => {
        let artistAlbum = artist.albums.find(a => a.name === parsedTrack.albumName);

        if (!artistAlbum) {
          artistAlbum = this._createAlbum(parsedTrack);
          artist.albums.push(artistAlbum);
        }

        if (artistAlbum.tracks.find(t => t.title === parsedTrack.title)) {
          this._logger.log(this, `Track with specified title ${artist.name} -> ${artistAlbum.name} -> ${parsedTrack.title} already exists, ending.`);
          return { updated: false, message: 'Track with specified title already exists!' };
        }

        artistAlbum.tracks.push(parsedTrack);
        return this._db.collection('artists')
          .updateOne({ name: artist.name }, { $set: artist })
          .then(() => {
            this._logger.log(this, `artist ${artist._id} ${artist.name} created/updated.`);
            return { updated: true, updatedArtist: artist, sourceTrack: parsedTrack };
          });
      });
  }

  _createArtist (parsedTrack) {
    return {
      name: parsedTrack.artistName,
      albums: []
    };
  }

  _createAlbum (uploadedTrack) {
    return {
      name: uploadedTrack.albumName,
      tracks: []
    };
  }
};
