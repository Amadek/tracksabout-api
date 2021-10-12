const TrackUploader = require('./TrackUploader');
const assert = require('assert');
const Logger = require('../Controllers/Logger');
const AritstHierarchyUpdater = require('./ArtistHierarchyUpdater');

module.exports = class ReversibleActionsFactory {
  constructor (dbClient) {
    assert.ok(dbClient); this._dbClient = dbClient;
  }

  createTrackUploader () {
    return new TrackUploader(this._dbClient, new Logger());
  }

  createArtistHierarchyUpdater () {
    return new AritstHierarchyUpdater(this._dbClient, new Logger());
  }
};
