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

  create (gitHubUserId) {
    const payload = { gitHubUserId };
    const token = JWT.sign(payload, this._config.jwtSignPassword, { algorithm: 'HS256' });
    return token;
  }

  parse (jwt) {
    try {
      const decodedJwt = JWT.verify(jwt, this._config.jwtSignPassword);
      return decodedJwt;
    } catch (err) {
      this._logger.log('Error occured in parsing JWT, returning null, erorr:\n' + err);
      return null;
    }
  }
};
