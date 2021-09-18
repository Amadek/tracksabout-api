const assert = require('assert');
const { GridFSBucket } = require('mongodb');

module.exports = class TrackStreamer {
  /**
   * @param {import('./Searcher/Searcher')} searcher
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('./Controllers/Logger')} logger
   */
  constructor (searcher, dbClient, logger) {
    assert.ok(searcher); this._searcher = searcher;
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(logger); this._logger = logger;
  }

  /**
   * @param {import('mongodb').ObjectID} trackId
   * @param {import('express').Response} httpResponse
   */
  async stream (trackId, httpResponse) {
    assert.ok(trackId);
    assert.ok(httpResponse);

    const track = await this._searcher.searchById(trackId);
    this._logger.log(this, `Track ${track._id} mimetype = ${track.mimetype}`);

    httpResponse.set('content-type', this._getHttpContentTypeFromMimetype(track.mimetype));
    httpResponse.set('accept-ranges', 'bytes');

    const bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes: 1024, bucketName: 'tracks' });
    const downloadTrackStream = bucket.openDownloadStream(track.fileId);

    return new Promise((resolve, reject) => {
      downloadTrackStream.on('data', (chunk) => {
        httpResponse.write(chunk);
      });

      downloadTrackStream.on('error', err => {
        this._logger.log(this, `Error occured in downloading stream for TrackId = ${trackId}. \n ${err}`);
        reject(err);
      });

      downloadTrackStream.on('end', () => {
        this._logger.log(this, `Streaming for TrackId = ${trackId} ends.`);
        httpResponse.end();
        resolve();
      });
    });
  }

  _getHttpContentTypeFromMimetype (trackMimetype) {
    switch (trackMimetype) {
      case 'audio/mpeg': return 'audio/mp3';
      case 'audio/flac': return trackMimetype;
      default: throw new Error(`Not supported track mimemtype ${trackMimetype} to map to HTTP Content-Type.`);
    }
  }
};
