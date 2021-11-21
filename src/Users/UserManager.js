const assert = require('assert');
const { MongoClient } = require('mongodb');
const LoggerFactory = require('../Logging/LoggerFactory');
const GitHubUser = require('./GitHubUser');

module.exports = class UserManager {
  /**
   * @param {MongoClient} dbClient
   * @param {LoggerFactory} loggerFactory
   */
  constructor (dbClient, loggerFactory) {
    assert.ok(dbClient instanceof MongoClient); this._dbClient = dbClient;
    assert.ok(loggerFactory instanceof LoggerFactory); this._logger = loggerFactory.create(this);
  }

  /**
   * @param {GitHubUser} gitHubUser
   */
  async addUser (gitHubUser) {
    assert.ok(gitHubUser instanceof GitHubUser);

    const userFromDb = await this._dbClient.db().collection('users').findOne({ _id: gitHubUser._id });
    if (userFromDb) {
      this._logger.log(`User with _id: ${gitHubUser._id} already exists, OK, ending.`);
      return;
    }

    await this._dbClient.db().collection('users').insertOne(gitHubUser);
    this._logger.log(`New user with _id: ${gitHubUser._id} added to DB.`);
  }

  /**
   * @param {number} userId
   * @returns {Promise<GitHubUser>} user
   */
  async getUser (userId) {
    assert.ok(typeof userId === 'number');
    const userFromDb = await this._dbClient.db().collection('users').findOne({ _id: userId });
    if (!userFromDb) return null;

    return new GitHubUser({ id: userFromDb._id, login: userFromDb.login, avatarUrl: userFromDb.avatarUrl });
  }
};
