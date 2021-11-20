const assert = require('assert');

module.exports = class GitHubUser {
  constructor ({ id, login }) {
    assert.ok(id); this._id = id;
    assert.ok(login); this.login = login;
    this.source = 'GitHub';
    this.created = new Date();
    this.isAdmin = false;
  }
};
