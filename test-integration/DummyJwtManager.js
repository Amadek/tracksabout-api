const { ObjectId } = require('mongodb');
const JwtManagerHS256 = require('../src/Controllers/JwtManagerHS256');

module.exports = class DummyJwtManager extends JwtManagerHS256 {
  create () {
    return `${new ObjectId().toHexString}.${new ObjectId().toHexString}.${new ObjectId().toHexString}`;
  }

  /**
   * @param {string} _jwt
   * @returns {{ gitHubUserId: number }} parsed token
   */
  parse (_jwt) {
    return { gitHubUserId: 1 };
  }
};
