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
    this._actionsToUndo = [];
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
  async cancellAllHandlingStreams () {
    for (const stream of this._handlingStreams) {
      // instanceof not working here because import('mongodb').GridFSBucketWriteStream is not a real class.
      if (stream.constructor.name === 'GridFSBucketWriteStream') {
        this._logger.log(this, 'GridFSBucketWriteStream aborting...');
        if (!stream.state.streamEnd) {
          await stream.abort();
          this._logger.log(this, 'GridFSBucketWriteStream aborted.');
        }
        this._logger.log(this, 'GridFSBucketWriteStream not aborted beacuse is ended.');
        continue;
      } else {
        stream.resume();
        this._logger.log(this, `Stream ${stream.constructor.name} resumed.`);
      }
    }
  }

  async undoPerformedActions () {
    const actionsToUndo = this._actionsToUndo.slice().reverse(); // slice() copies an array. We need to rollback changes in reverse mode.
    this._logger.log(this, `Actions to undo:\n${actionsToUndo.map(a => a.constructor.name).join('\n')}`);
    for (const actionToUndo of actionsToUndo) {
      await actionToUndo.undo();
    }
  }

  /**
   * @protected
   * @param {*} stream
   * @returns added stream
   */
  addHandlingStream (stream) {
    this._handlingStreams.push(stream);
    this._logger.log(this, `Stream ${stream.constructor.name} added to handle.`);
    return stream;
  }

  /**
   * @protected
   * @param {import('../UndoRedo')} action
   */
  addActionToUndo (action) {
    this._actionsToUndo.push(action);
  }
};
