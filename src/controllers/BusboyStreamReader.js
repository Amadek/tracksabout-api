const assert = require('assert');

/**
 * Abstract class of busboy stream reader.
 * Has ability to cancel all handling streams.
 */
module.exports = class BusboyStreamReader {
  /**
   * @param {import('./Logger')} logger
   */
  constructor (logger) {
    assert.ok(logger); this._logger = logger;
    this._handlingFileStreams = [];
  }

  readFileStream (fileStream, filename, mimetype) {
    assert.ok(fileStream);
    assert.ok(filename);
    assert.ok(mimetype);

    this._handlingFileStreams.push(fileStream);

    this._logger.log(this, 'File stream reading...\n' + JSON.stringify({
      ended: fileStream._readableState.ended,
      reading: fileStream._readableState.reading,
      destroyed: fileStream._readableState.destroyed,
      closed: fileStream._readableState.closed
    }, null, 2));
  }

  cancellAllStreamsReading () {
    for (const fileStream of this._handlingFileStreams) {
      const fileStreamResumeResult = fileStream.resume();
      this._logger.log(this, 'File stream cancelled. \n' + JSON.stringify({
        ended: fileStreamResumeResult._readableState.ended,
        reading: fileStreamResumeResult._readableState.reading,
        destroyed: fileStreamResumeResult._readableState.destroyed,
        closed: fileStreamResumeResult._readableState.closed
      }, null, 2));
    }
  }
};
