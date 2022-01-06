const assert = require('assert');

module.exports = class TrackRemover {
  /**
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../Logging/LoggerFactory')} loggerFactory
   */
  constructor (dbClient, loggerFactory) {
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(loggerFactory); this._logger = loggerFactory.create(this);
  }

  /**
   * @param {import('mongodb').ObjectId} trackId
   */
  async remove (trackId) {
    const artist = await this._dbClient.db().collection('artists').findOne({ 'albums.tracks._id': trackId });
    if (!artist) return { success: false, message: `Track with provided id ${trackId.toHexString()} does not exist.` };

    const album = artist.albums.find(a => a.tracks.some(t => t._id.toHexString() === trackId.toHexString()));
    if (album.tracks.length !== 1) {
      await this._dbClient.db().collection('artists').updateOne({}, { $pull: { 'albums.$[].tracks': { _id: trackId } } });
      this._logger.log(`Track ${trackId.toHexString()} removed.`);
      return { success: true, deletedObjectType: 'track' };
    }

    if (artist.albums.length !== 1) {
      await this._dbClient.db().collection('artists').updateOne({}, { $pull: { albums: { _id: album._id } } });
      this._logger.log(`Album ${album._id.toHexString()} removed.`);
      return { success: true, deletedObjectType: 'album' };
    }

    await this._dbClient.db().collection('artists').deleteOne({ _id: artist._id });
    this._logger.log(`Artist ${artist._id.toHexString()} removed.`);
    return { success: true, deletedObjectType: 'artist' };
  }
};
