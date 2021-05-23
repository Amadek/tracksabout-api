const assert = require('assert');

module.exports = class TrackFinder {
  /**
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../controllers/Logger')} logger
   */
  constructor (dbClient, logger) {
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(logger); this._logger = logger;
  }

  /**
   * @param {RegExp} trackTitleRegexp
   */
  async find (trackTitleRegexp) {
    assert.ok(trackTitleRegexp);

    this._logger.log(this, 'Find tracks started.');

    const tracks = await this._dbClient.db().collection('artists').aggregate([
      { $unwind: '$albums' },
      { $unwind: '$albums.tracks' },
      { $match: { 'albums.tracks.title': trackTitleRegexp } },
      { $project: { _id: 0, track: '$albums.tracks' } }
    ]).toArray();

    this._logger.log(this, `Find tracks completed. Found ${tracks.length} elements.`);

    return tracks;
  }
};
