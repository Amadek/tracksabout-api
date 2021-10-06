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
    this._handlingStreams = [];
  }

  /**
   * @virtual
   * @param {import('stream').Stream} fileStream
   * @param {*} filename
   * @param {*} mimetype
   */
  readFileStream (fileStream, filename, mimetype) {
    assert.ok(fileStream);
    assert.ok(filename);
    assert.ok(mimetype);

    this.addHandlingStream(fileStream);
  }

  /**
   * @public
   */
  cancellAllStreamsReading () {
    for (const stream of this._handlingStreams) {
      // instanceof not working here because import('mongodb').GridFSBucketWriteStream is not a real class.
      if (stream.constructor.name === 'GridFSBucketWriteStream') {
        stream.abort();
        this._logger.log(this, 'GridFSBucketWriteStream aborted.' + JSON.stringify({
          type: stream.constructor.name,
          ended: stream._writableState.ended,
          reading: stream._writableState.reading,
          destroyed: stream._writableState.destroyed,
          closed: stream._writableState.closed
        }, null, 2));
        continue;
      } else {
        stream.resume();
        this._logger.log(this, 'File stream resumed. \n' + JSON.stringify({
          type: stream.constructor.name,
          ended: stream._readableState.ended,
          reading: stream._readableState.reading,
          destroyed: stream._readableState.destroyed,
          closed: stream._readableState.closed
        }, null, 2));
      }
    }
  }

  /**
   * @protected
   * @param {*} stream
   * @returns added stream
   */
  addHandlingStream (stream) {
    this._handlingStreams.push(stream);
    return stream;
  }
};
