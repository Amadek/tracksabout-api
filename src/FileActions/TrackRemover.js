const assert = require('assert');
const { GridFSBucket } = require('mongodb');

module.exports = class TrackRemover {
  /**
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../Users/UserManager')} userManager
   * @param {import('../Config')} config
   * @param {import('../Logging/LoggerFactory')} loggerFactory
   */
  constructor (dbClient, userManager, config, loggerFactory) {
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(userManager); this._userManager = userManager;
    assert.ok(config); this._config = config;
    assert.ok(loggerFactory); this._logger = loggerFactory.create(this);
    this._bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes: 1024, bucketName: 'tracks' });
  }

  /**
   * @param {import('mongodb').ObjectId} trackId
   * @param {number} userId
   */
  async remove (trackId, userId) {
    const artist = await this._dbClient.db().collection('artists').findOne({ 'albums.tracks._id': trackId });
    if (!artist) return { success: false, message: `Track with provided id ${trackId.toHexString()} does not exist.` };

    const album = artist.albums.find(a => a.tracks.some(t => t._id.toHexString() === trackId.toHexString()));
    const userTrack = album.tracks.find(t => t._id.toHexString() === trackId.toHexString());
    if (!userTrack) return { success: false, message: `Track with provided id ${trackId.toHexString()} does not exist.` };

    const user = await this._userManager.getUser(userId);
    if (!user.isAdmin && user._id !== userTrack.userId) return { success: false, message: `Track with provided id ${trackId.toHexString()} belongs to another user, not to ${user._id}, which is not admin.` };

    await this._bucket.delete(userTrack.fileId);
    this._logger.log(`Track ${trackId.toHexString()} ${userTrack.fileId.toHexString()} file removed.`);

    if (album.tracks.length !== 1) {
      await this._dbClient.db().collection('artists').updateMany({}, { $pull: { 'albums.$[].tracks': { _id: trackId } } });
      this._logger.log(`Track ${trackId.toHexString()} removed.`);
      return { success: true, deletedObjectType: 'track' };
    }

    if (artist.albums.length !== 1) {
      await this._dbClient.db().collection('artists').updateMany({}, { $pull: { albums: { _id: album._id } } });
      this._logger.log(`Album ${album._id.toHexString()} removed.`);
      return { success: true, deletedObjectType: 'album' };
    }

    await this._dbClient.db().collection('artists').deleteOne({ _id: artist._id });
    this._logger.log(`Artist ${artist._id.toHexString()} removed.`);
    return { success: true, deletedObjectType: 'artist' };
  }

  async _validateUser (userId, track) {

  }
};
