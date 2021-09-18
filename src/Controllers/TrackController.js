const assert = require('assert');
const { Router } = require('express');
const { BadRequest } = require('http-errors');
const Busboy = require('busboy');
const BusboyInPromiseWrapper = require('./BusboyInPromiseWrapper');
const Logger = require('./Logger');
const { GridFSBucket, ObjectID } = require('mongodb');

module.exports = class TrackController {
  /**
   * @param {import('./BusboyStreamReaderToUploadTrack')} busboyStreamReaderToUploadTrack
   * @param {import('./BusboyStreamReaderToValidateTrack')} busboyStreamReaderToValidateTrack
   * @param {import('../Searcher/Searcher')} searcher
   * @param {import('mongodb').MongoClient} dbClient
   * @param {import('../Controllers/Logger')} logger
   */
  constructor (busboyStreamReaderToUploadTrack, busboyStreamReaderToValidateTrack, searcher, dbClient, logger) {
    assert.ok(busboyStreamReaderToUploadTrack); this._busboyStreamReaderToUploadTrack = busboyStreamReaderToUploadTrack;
    assert.ok(busboyStreamReaderToValidateTrack); this._busboyStreamReaderToValidateTrack = busboyStreamReaderToValidateTrack;
    assert.ok(searcher); this._searcher = searcher;
    assert.ok(dbClient); this._dbClient = dbClient;
    assert.ok(logger); this._logger = logger;
    this._busboyWrapper = new BusboyInPromiseWrapper(new Logger());
  }

  route () {
    const router = Router();
    router.post('/', this._postTrack.bind(this));
    router.post('/validate', this._postValidateTrack.bind(this));
    router.get('/stream/:id', this._getStreamTrack.bind(this));
    return router;
  }

  /**
   * Uploads new track.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async _postTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      const uploadedTrackIds = await this._busboyWrapper.handle(req, new Busboy({ headers: req.headers }), this._busboyStreamReaderToUploadTrack);
      this._logger.log(this, `Returned fileIds = ${JSON.stringify(uploadedTrackIds)} of uploaded tracks.`);

      return res.json(uploadedTrackIds);
    } catch (error) {
      const knownErrorMessages = [
        'Multipart: Boundary not found',
        'Missing Content-Type',
        'Guessed MIME-type not supported'
      ];

      if (knownErrorMessages.some(errorMessage => error.message.includes(errorMessage))) return next(new BadRequest(error.message));

      next(error);
    }
  }

  /**
   * Validates new track if can be uploaded.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async _postValidateTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      const [parsedTrack] = await this._busboyWrapper.handle(req, new Busboy({ headers: req.headers }), this._busboyStreamReaderToValidateTrack);

      return res.json(parsedTrack);
    } catch (error) {
      next(error);
    }
  }

  async _getStreamTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      if (!req.params.id || !ObjectID.isValid(req.params.id)) throw new BadRequest('Track Id is empty or invalid!');

      res.set('content-type', 'audio/mp3');
      res.set('accept-ranges', 'bytes');

      const trackId = new ObjectID(req.params.id);
      const track = await this._searcher.searchById(trackId);

      const bucket = new GridFSBucket(this._dbClient.db(), { chunkSizeBytes: 1024, bucketName: 'tracks' });

      const downloadTrackStream = bucket.openDownloadStream(track.fileId);
      downloadTrackStream.on('data', (chunk) => {
        res.write(chunk);
      });
      downloadTrackStream.on('error', err => {
        const errorMessage = `Error occured in downloading stream for TrackId = ${req.params.id}. \n ${err}`;
        this._logger.log(this, errorMessage);
        res.status(500).json({ message: errorMessage });
      });
      downloadTrackStream.on('end', () => {
        res.end();
      });
    } catch (error) {
      next(error);
    }
  }
};
