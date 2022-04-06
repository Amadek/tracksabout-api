const { ObjectId } = require('mongodb');
const JwtManagerHS256 = require('../src/Controllers/JwtManagerHS256');

module.exports = class DummyJwtManager extends JwtManagerHS256 {
  /**
   * @param {import('../src/Config')} config
   * @param {import('../src/Logging/LoggerFactory')} loggerFactory
   */
  constructor (config, loggerFactory, simulationConfig) {
    super(config, loggerFactory);
    this._simulationConfig = simulationConfig;
  }

  create () {
    return `${new ObjectId().toHexString}.${new ObjectId().toHexString}.${new ObjectId().toHexString}`;
  }

  /**
   * @param {string} _jwt
   * @returns {{ gitHubUserId: number }} parsed token
   */
  parse (_jwt) {
    const gitHubUserId = this._simulationConfig?.gitHubUserId ?? 1;
    return { gitHubUserId };
  }
};
