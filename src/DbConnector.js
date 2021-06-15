const { MongoClient } = require('mongodb');
const assert = require('assert');

module.exports = class DbConnector {
  /**
   * @param {import('./Config')} config
   */
  constructor (config) {
    assert.ok(config);
    this._mongoClient = new MongoClient(config.dbConnectionString, { useNewUrlParser: true, useUnifiedTopology: true });
  }

  async connect () {
    const dbClient = await this._mongoClient.connect();
    return dbClient;
  }

  close () {
    this._mongoClient.close();
  }
};
