const debug = require('debug');
const assert = require('assert');

module.exports = class Logger {
  log (sender, message) {
    assert.ok(sender);
    assert.ok(message);

    if (!this._debugScope) this._debugScope = debug('tracksabout-api:' + this._getSenderName(sender));
    this._debugScope(message);
  }

  _getSenderName (sender) {
    switch (typeof sender) {
      case 'object': return sender.constructor.name;
      case 'string': return sender;
    }
  }
};
