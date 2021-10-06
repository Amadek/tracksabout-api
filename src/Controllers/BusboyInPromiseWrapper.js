const assert = require('assert');

module.exports = class BusboyInPromiseWrapper {
  /**
   * @param {import('../Controllers/Logger')} logger
   */
  constructor (logger) {
    assert.ok(logger);
    this._logger = logger;
  }

  /**
   * @param {import('express').Request} httpRequest
   * @param {*} busboy
   * @param {import('./BusboyStreamReader')} busboyStreamReader
   * @returns {Promise}
   */
  handle (httpRequest, busboy, busboyStreamReader) {
    assert.ok(httpRequest);
    assert.ok(busboy);
    assert.ok(busboyStreamReader);

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
            .then(() => busboyStreamReader.readFileStream(fileStream, filename, mimetype))
            // We catch error here because:
            // 1. Promise.all in busboy.onFinish is created after busboy.onFile ends, which ends on end of stream.
            //    Before file stream ends, if error occur there would be no error handling.
            //    Promise.all would not be created. Noone waits or catch errors in created Promise.
            // 2. When error is catched here, we need to return it to notify Promise.all to do nothing, because error is already handled.
            .catch(err => {
              this._logger.log(this, 'Error in file handler: ' + err.message);
              // When in at least one stream handling error occur, we cancell all streams reading -> all or none method.
              busboyStreamReader.cancellAllStreamsReading();
              reject(err);
              throw err;
            });

          readFileStreamPromises.push(promise);
        })
        .on('finish', async () => {
          try {
            this._logger.log(this, 'File streams from request loaded to memory by Busboy.');
            const readFileResults = await Promise.all(readFileStreamPromises);
            this._logger.log(this, 'Busboy finish after waiting promise');
            resolve(readFileResults);
          } catch (error) {
            this._logger.log(this, 'Error in finish handler: ' + error.message);
            reject(error);
          }
        })
        .on('error', err => {
          this._logger.log(this, 'Error in error handler: ' + err.message);
          reject(err);
        });

      httpRequest.pipe(busboy);
    });
  }
};
