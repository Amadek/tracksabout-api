const assert = require('assert');
const JWT = require('jsonwebtoken');
const Config = require('../Config');
const LoggerFactory = require('../Logging/LoggerFactory');

/** JSON Web Token manager using HS256. */
module.exports = class JwtManagerHS256 {
  /**
   * @param {Config} config
   * @param {LoggerFactory} loggerFactory
   */
  constructor (config, loggerFactory) {
    assert.ok(config instanceof Config); this._config = config;
    assert.ok(loggerFactory instanceof LoggerFactory); this._logger = loggerFactory.create(this);
  }

  /**
   * @param {number} gitHubUserId
   * @param {string} clientIp
   * @returns {string} token
   */
  create (gitHubUserId, clientIp) {
    assert.ok(typeof gitHubUserId === 'number');
    assert.ok(typeof clientIp === 'string');
    this._logger.log(`Client IP used for signing JWT: ${clientIp}`);
    const payload = { gitHubUserId };
    const signPassword = this._config.jwtSignPassword + clientIp;
    const token = JWT.sign(payload, signPassword, { algorithm: 'HS256' });
    return token;
  }

  /**
   * @param {string} jwt
   * @param {string} clientIp
   * @returns {{ gitHubUserId: number }} parsed token
   */
  parse (jwt, clientIp) {
    try {
      this._logger.log(`Client IP used for parsing JWT: ${clientIp}`);
      const signPassword = this._config.jwtSignPassword + clientIp;
      const decodedJwt = JWT.verify(jwt, signPassword);
      // @ts-ignore - decodedJwt has gitHubUserId
      return { gitHubUserId: decodedJwt.gitHubUserId };
    } catch (err) {
      this._logger.log('Error occured in parsing JWT, returning null, erorr:\n' + err);
      return null;
    }
  }
};
