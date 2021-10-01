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
    const { length: trackFileSize } = await this._dbClient.db()
      .collection('tracks.files')
      .findOne({ _id: track.fileId }, { projection: { length: 1 } });

    const chunkSizeBytes = 1024;
    const bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes, bucketName: 'tracks' });
    const downloadTrackStream = bucket.openDownloadStream(track.fileId);

    httpResponse.set('Content-Length', trackFileSize);
    httpResponse.set('Content-Type', this._getHttpContentTypeFromMimetype(track.mimetype));
    httpResponse.set('Accept-Ranges', 'bytes');
    httpResponse.set('Cache-Control', 'no-cache');
    httpResponse.writeHead(200);

    return new Promise((resolve, reject) => {
      let chunkNumber = 0;
      downloadTrackStream.on('data', (chunk) => {
        if (++chunkNumber % chunkSizeBytes === 0) this._logger.log(this, `Writing chunk... ${chunkNumber}`);
      });

      downloadTrackStream.on('error', err => {
        this._logger.log(this, `Error occured in downloading stream for TrackId = ${trackId}.\n ${err}`);
        reject(err);
      });

      downloadTrackStream.on('end', () => {
        this._logger.log(this, `Streaming for TrackId = ${trackId} ends.`);
        resolve();
      });

      downloadTrackStream.pipe(httpResponse);
      this._logger.log(this, `Track ${track.title} (${track._id}) mimetype = ${track.mimetype}, length = ${trackFileSize} start streaming...`);
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
