const debug = require('debug');
const assert = require('assert');
const packageJson = require('../../package.json');

module.exports = class Logger2 {
  constructor (sender) {
    assert.ok(sender);
    this._debugScope = debug(`${packageJson.name}:${this._getSenderName(sender)}`);
  }

  log (message) {
    assert.ok(message);
    this._debugScope(message);
  }

  _getSenderName (sender) {
    switch (typeof sender) {
      case 'object': return sender.constructor.name;
      case 'string': return sender;
      default: throw new Error(`Not supported object type: ${typeof sender}`);
    }
  }
};
