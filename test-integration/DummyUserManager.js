const { ObjectId } = require('mongodb');
const GitHubUser = require('../src/Users/GitHubUser');
const UserManager = require('../src/Users/UserManager');

module.exports = class DummyUserManager extends UserManager {
  constructor (dbClient, loggerFactory, simulationConfig) {
    super(dbClient, loggerFactory);
    this._simulationConfig = simulationConfig;
  }

  async addUser () {
    throw new Error('Not supported yet in tests.');
  }

  async getUser (userId) {
    return new GitHubUser({
      id: userId,
      login: new ObjectId().toHexString(),
      avatarUrl: new ObjectId().toHexString(),
      isAdmin: this._simulationConfig?.isAdmin ?? false
    });
  }
};
