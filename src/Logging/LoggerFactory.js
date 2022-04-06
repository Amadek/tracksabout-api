const assert = require('assert');
const Logger2 = require('./Logger2');

module.exports = class LoggerFactory {
  create (sender) {
    assert.ok(sender);
    return new Logger2(sender);
  }
};
