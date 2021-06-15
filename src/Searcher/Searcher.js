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
      await this._findTracks(trackTitleRegexp),
      await this._findAlbums(trackTitleRegexp),
      await this._findArtists(trackTitleRegexp)
    ];

    searchResults = searchResults.flat();

    this._logger.log(this, `Search completed. Found ${searchResults.length} elements.`);

    return searchResults;
  }

  async _findTracks (trackTitleRegexp) {
    const tracks = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $unwind: '$albums.tracks' },
      { $match: { 'albums.tracks.title': trackTitleRegexp } },
      {
        $project: {
          _id: 0,
          type: SearchResultType.track,
          title: '$albums.tracks.title',
          albumName: '$albums.name',
          artistName: '$name'
        }
      }
    ]).toArray();

    return tracks;
  }

  async _findAlbums (albumNameRegexp) {
    const albums = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $match: { 'albums.name': albumNameRegexp } },
      {
        $project: {
          _id: 0,
          type: SearchResultType.album,
          title: '$albums.name',
          artistName: '$name'
        }
      }
    ]).toArray();

    return albums;
  }

  async _findArtists (albumNameRegexp) {
    const artists = await this._dbClient.db().collection('artists').aggregate([
      { $match: { name: albumNameRegexp } },
      {
        $project:
        {
          _id: 0,
          type: SearchResultType.artist,
          title: '$name'
        }
      }
    ]).toArray();

    return artists;
  }
};
