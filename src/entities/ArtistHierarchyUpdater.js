const assert = require('assert');

module.exports = class AritstHierarchyUpdater {
  constructor (db) {
    assert.ok(db);
    this._db = db;
  }

  update (parsedTrack) {
    assert.ok(parsedTrack);
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

        if (artistAlbum.tracks.find(t => t.title === parsedTrack.title)) return { updated: false, message: 'Track with specified name already exists!' };

        artistAlbum.tracks.push(parsedTrack);
        return this._db.collection('artists')
          .updateOne({ name: artist.name }, { $set: artist })
          .then(() => ({ updated: true, updatedArtist: artist, sourceTrack: parsedTrack }));
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
