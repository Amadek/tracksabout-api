const assert = require('assert');

module.exports = class GitHubUser {
  constructor ({ id, login, avatarUrl, isAdmin }) {
    assert.ok(id); this._id = id;
    assert.ok(typeof login === 'string'); this.login = login;
    assert.ok(typeof avatarUrl === 'string'); this.avatarUrl = avatarUrl;
    this.source = 'GitHub';
    this.created = new Date();
    this.isAdmin = isAdmin ?? false;
  }
};
