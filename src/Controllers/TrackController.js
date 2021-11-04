const assert = require('assert');
const { Router } = require('express');
const { BadRequest, NotFound } = require('http-errors');
const Busboy = require('busboy');
const { BusboyInPromiseWrapper, BusboyActionsFactory } = require('../RequestActions');
const Logger = require('../Logging/Logger');
const { ObjectId } = require('mongodb');
const TrackStreamer = require('../FileActions/TrackStreamer');
const { ITrackParser } = require('../FileActions');

module.exports = class TrackController {
  /**
   * @param {BusboyActionsFactory} busboyActionsFactory
   * @param {TrackStreamer} trackStreamer
   * @param {ITrackParser} trackParser
   * @param {Logger} logger
   */
  constructor (busboyActionsFactory, trackStreamer, trackParser, logger) {
    assert.ok(busboyActionsFactory instanceof BusboyActionsFactory); this._busboyActionsFactory = busboyActionsFactory;
    assert.ok(trackStreamer instanceof TrackStreamer); this._trackStreamer = trackStreamer;
    assert.ok(trackParser instanceof ITrackParser); this._trackParser = trackParser;
    assert.ok(logger instanceof Logger); this._logger = logger;
    this._busboyWrapper = new BusboyInPromiseWrapper(new Logger());
  }

  route () {
    const router = Router();
    router.post('/', this._postTrack.bind(this));
    router.post('/validate', this._postValidateTrack.bind(this));
    router.get('/stream/:id', this._getStreamTrack.bind(this));
    router.get('/cover/:id', this._getTrackCover.bind(this));
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
      const streamReaderToUploadTrack = this._busboyActionsFactory.createStreamReaderToUploadTrack();
      const uploadedTrackIds = await this._busboyWrapper.handle(req, new Busboy({ headers: req.headers }), streamReaderToUploadTrack);
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
      const streamReaderToValidateTrack = this._busboyActionsFactory.createStreamReaderToValidateTrack();
      const [parsedTrack] = await this._busboyWrapper.handle(req, new Busboy({ headers: req.headers }), streamReaderToValidateTrack);

      return res.json(parsedTrack);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async _getStreamTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      await this._trackStreamer.stream(req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async _getTrackCover (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      if (!req.params.id || !ObjectId.isValid(req.params.id)) throw new BadRequest('Track Id is empty or invalid!');

      const trackId = new ObjectId(req.params.id);
      const trackStream = await this._trackStreamer.getStream(trackId);
      if (!trackStream) throw new NotFound();

      const trackCover = await this._trackParser.getCover(trackStream.stream, trackStream.mimetype);

      return res.json(trackCover);
    } catch (error) {
      next(error);
    }
  }
};
