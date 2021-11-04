const assert = require('assert');
const { GridFSBucket, ObjectId } = require('mongodb');
const { BadRequest } = require('http-errors');

module.exports = class TrackStreamer {
  /**
   * @param {import('../SearchActions/Searcher')} searcher
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../Logging/Logger')} logger
   */
  constructor (searcher, dbClient, logger) {
    assert.ok(searcher); this._searcher = searcher;
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(logger); this._logger = logger;
  }

  async stream (httpRequest, httpResponse) {
    assert.ok(httpRequest);
    assert.ok(httpRequest.headers.range);
    assert.ok(httpResponse);

    if (!httpRequest.params.id || !ObjectId.isValid(httpRequest.params.id)) throw new BadRequest('Track Id is empty or invalid!');

    const trackId = new ObjectId(httpRequest.params.id);
    const track = await this._searcher.searchById(trackId);
    const { length: trackFileSizeFromDb } = await this._dbClient.db()
      .collection('tracks.files')
      .findOne({ _id: track.fileId }, { projection: { length: 1 } });
    this._logger.log(this, 'trackFileSizeFromDb:' + trackFileSizeFromDb);

    const { fileStart, fileEnd } = this._parseFileRange(httpRequest, trackFileSizeFromDb);
    this._logger.log(this, `fileStart: ${fileStart}, fileEnd: ${fileEnd}`);

    const httpResponseHeaders = {};
    httpResponseHeaders['Content-Range'] = `bytes ${fileStart}-${fileEnd}/${trackFileSizeFromDb}`;
    httpResponseHeaders['Content-Length'] = fileStart === fileEnd ? 0 : fileEnd - fileStart + 1;
    httpResponseHeaders['Content-Type'] = 'audio/x-flac';
    httpResponseHeaders['Accept-Ranges'] = 'bytes';
    httpResponseHeaders['Cache-Control'] = 'no-cache';
    httpResponse.writeHead(206, httpResponseHeaders);

    const chunkSizeBytes = 256;
    const bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes, bucketName: 'tracks' });
    const downloadTrackStream = bucket.openDownloadStream(track.fileId, { start: fileStart, end: fileEnd + 1 }); // It seems it's taking end value exclusive, that's why +1.

    return new Promise((resolve, reject) => {
      let chunkNumer = 1;
      downloadTrackStream.on('data', () => {
        if (++chunkNumer % 256 === 0) this._logger.log(this, `Streaming chunk ${chunkNumer}...`);
      });
      downloadTrackStream.on('end', () => {
        this._logger.log(this, `Streaming for TrackId = ${trackId} ends.`);
        resolve();
      });
      downloadTrackStream.on('error', err => {
        this._logger.log(this, `Error occured in downloading stream for TrackId = ${trackId}.\n ${err.message}`);
        reject(err);
      });

      this._logger.log(this, `Track ${track.title} (${track._id}) mimetype = ${track.mimetype}, length = ${trackFileSizeFromDb} start streaming...`);
      downloadTrackStream.pipe(httpResponse);
    });
  }

  async getStream (trackId) {
    assert.ok(trackId);
    this._logger.log(this, `Get track stream for track id: ${trackId}`);
    const track = await this._searcher.searchById(trackId);
    if (!track) return null;

    const { length: trackFileSizeFromDb } = await this._dbClient.db()
      .collection('tracks.files')
      .findOne({ _id: track.fileId }, { projection: { length: 1 } });

    const chunkSizeBytes = 256;
    const bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes, bucketName: 'tracks' });
    const downloadTrackStream = bucket.openDownloadStream(track.fileId, { start: 0, end: trackFileSizeFromDb });
    return { stream: downloadTrackStream, mimetype: track.mimetype };
  }

  _parseFileRange (httpRequest, fileLength) {
    const range = httpRequest.headers.range.split(/bytes=([0-9]*)-([0-9]*)/);
    const fileStart = parseInt(range[1]);
    const fileEnd = parseInt(range[2]);

    if (!isNaN(fileStart) && isNaN(fileEnd)) {
      return {
        fileStart,
        fileEnd: fileLength - 1
      };
    }

    if (isNaN(fileStart) && !isNaN(fileEnd)) {
      return {
        fileStart: fileLength - fileEnd,
        fileEnd: fileLength - 1
      };
    }

    return {
      fileStart: isNaN(fileStart) ? 0 : fileStart,
      fileEnd: isNaN(fileEnd) ? fileLength - 1 : fileEnd
    };
  }

  _getHttpContentTypeFromMimetype (trackMimetype) {
    switch (trackMimetype) {
      case 'audio/mpeg': return 'audio/mp3';
      case 'audio/flac': return trackMimetype;
      default: throw new Error(`Not supported track mimemtype ${trackMimetype} to map to HTTP Content-Type.`);
    }
  }
};
