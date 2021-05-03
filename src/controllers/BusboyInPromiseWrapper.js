const assert = require('assert');

module.exports = class BusboyInPromiseWrapper {
  /**
   * @param {import('../controllers/Logger')} logger
   */
  constructor (logger) {
    assert.ok(logger);
    this._logger = logger;
  }

  handle (req, busboy, readFileStream) {
    assert.ok(req);
    assert.ok(busboy);
    assert.ok(readFileStream);

    return new Promise((resolve, reject) => {
      const readFileStreamPromises = [];

      busboy
        .on('file', (fieldname, file, filename, _encoding, mimetype) => {
          this._logger.log(this, `File from field = ${fieldname} (${filename}) stream begins.`);
          // Multiple files handling. Collects all upload track promises and waits for all of them on busboy.finish.
          // File event triggers on every file, but finish event triggers only once.
          // Multiple file streams are handled concurrently!
          const fileStream = file;
          const promise = Promise.resolve()
            .then(() => readFileStream(fileStream, filename, mimetype))
            // We catch error here because:
            // 1. Promise.all in busboy.onFinish is created after busboy.onFile ends, which ends on end of stream.
            //    Before file stream ends, if error occur there would be no error handling.
            //    Promise.all would not be created. Noone waits or catch errors in created Promise.
            // 2. When error is catched here, we need to return it to notify Promise.all to do nothing, because error is already handled.
            .catch(err => { this._logger.log(this, 'Error in file handler: ' + err.message); reject(err); return err; })
            // We do not need the stream any more so we are ending using it.
            .finally(() => fileStream.resume());

          readFileStreamPromises.push(promise);
        })
        .on('finish', () => {
          this._logger.log(this, 'Last file stream ends.');
          Promise.all(readFileStreamPromises)
            .then(results => {
              const err = results.find(r => r instanceof Error);
              if (err) {
                err.occuredInFileReading = true;
                throw err;
              }

              return results;
            })
            .then(results => resolve(results))
            .catch(err => {
              if (err.occuredInFileReading) return;
              this._logger.log(this, 'Error in finish handler: ' + err.message);
              reject(err);
            });
        })
        .on('error', err => {
          this._logger.log(this, 'Error in error handler: ' + err.message);
          reject(err);
        });

      req.pipe(busboy);
    });
  }
};
