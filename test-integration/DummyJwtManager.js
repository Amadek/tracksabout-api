const { ObjectId } = require('mongodb');
const JwtManagerHS256 = require('../src/Controllers/JwtManagerHS256');

module.exports = class DummyJwtManager extends JwtManagerHS256 {
  create () {
    return `${new ObjectId().toHexString}.${new ObjectId().toHexString}.${new ObjectId().toHexString}`;
  }

  parse () {
    return { gitHubUserId: new ObjectId().toHexString() };
  }
};
