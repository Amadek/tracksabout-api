const debug = require('debug');

module.exports = class Logger {
  /**
   * @param {object} sender
   * @param {any} message
   */
  log (sender, message) {
    if (!this._debugScope) this._debugScope = debug('tracksabout-api:' + sender.constructor.name);
    this._debugScope(message);
  }
};
