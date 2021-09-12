const assert = require('assert');
const SearchResultType = require('./SearchResultType');

module.exports = class Searcher {
  /**
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../Controllers/Logger')} logger
   */
  constructor (dbClient, logger) {
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(logger); this._logger = logger;
  }

  /**
   * @param {RegExp} trackTitleRegexp
   */
  async search (trackTitleRegexp) {
    assert.ok(trackTitleRegexp);

    this._logger.log(this, 'Search started.');

    let searchResults = [
      await this._searchTracks(trackTitleRegexp),
      await this._searchAlbums(trackTitleRegexp),
      await this._searchArtists(trackTitleRegexp)
    ];

    searchResults = searchResults.flat();

    this._logger.log(this, `Search completed. Found ${searchResults.length} elements.`);

    return searchResults;
  }

  /**
   * Search tracks, albums and artists by Id.
   * @param {import('mongodb').ObjectID} guid
   * @returns searched track, album or artist with specific type.
   */
  async searchById (guid) {
    assert.ok(guid);

    this._logger.log(this, `Search by id = ${guid.toHexString()} started.`);

    const artist = await this._searchArtist(guid);
    if (artist) {
      this._logger.log(this, `Search by id = ${guid.toHexString()} completed. Artist`);
      return artist;
    }

    const album = await this._searchAlbum(guid);
    if (album) {
      this._logger.log(this, `Search by id = ${guid.toHexString()} completed. Album found.`);
      return album;
    }

    const track = await this._searchTrack(guid);
    if (track) {
      this._logger.log(this, `Search by id = ${guid.toHexString()} completed. Track found.`);
      return track;
    }

    this._logger.log(this, `Search by id = ${guid.toHexString()} completed. Not found.`);
    return null;
  }

  async _searchArtist (guid) {
    const artist = await this._dbClient.db().collection('artists').aggregate([
      { $match: { _id: guid } },
      { $unwind: '$albums' },
      {
        $project:
        {
          _id: '$_id',
          name: '$name',
          album:
          {
            _id: '$albums._id',
            name: '$albums.name',
            year: '$albums.year'
          }
        }
      },
      {
        $group:
        {
          _id: '$_id',
          name: { $first: '$name' },
          albums: { $addToSet: '$album' }
        }
      }
    ]).next();

    if (artist) {
      artist.type = SearchResultType.artist;
    }

    return artist;
  }

  async _searchAlbum (guid) {
    const album = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $match: { 'albums._id': guid } },
      {
        $project:
        {
          _id: '$albums._id',
          name: '$albums.name',
          artistName: '$name',
          artistId: '$_id',
          year: '$albums.year',
          type: SearchResultType.album,
          tracks: '$albums.tracks'
        }
      }
    ]).next();

    return album;
  }

  async _searchTrack (guid) {
    const track = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $unwind: '$albums.tracks' },
      { $match: { 'albums.tracks._id': guid } },
      {
        $project:
        {
          _id: '$albums.tracks._id',
          fileId: '$albums.tracks.fileId',
          albumId: '$albums._id',
          title: '$albums.tracks.title',
          albumName: '$albums.tracks.albumName',
          artistName: '$albums.tracks.artistName',
          year: '$albums.tracks.year',
          mimetype: '$albums.tracks.mimetype',
          type: SearchResultType.track
        }
      }
    ]).next();

    return track;
  }

  async _searchTracks (trackTitleRegexp) {
    const tracks = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $unwind: '$albums.tracks' },
      { $match: { 'albums.tracks.title': trackTitleRegexp } },
      {
        $project: {
          _id: '$albums.tracks._id',
          type: SearchResultType.track,
          title: '$albums.tracks.title',
          albumName: '$albums.name',
          artistName: '$name'
        }
      }
    ]).toArray();

    return tracks;
  }

  async _searchAlbums (albumNameRegexp) {
    const albums = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $match: { 'albums.name': albumNameRegexp } },
      {
        $project: {
          _id: '$albums._id',
          type: SearchResultType.album,
          title: '$albums.name',
          artistName: '$name'
        }
      }
    ]).toArray();

    return albums;
  }

  async _searchArtists (albumNameRegexp) {
    const artists = await this._dbClient.db().collection('artists').aggregate([
      { $match: { name: albumNameRegexp } },
      {
        $project:
        {
          _id: 1,
          type: SearchResultType.artist,
          title: '$name'
        }
      }
    ]).toArray();

    return artists;
  }
};
