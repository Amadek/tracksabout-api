const assert = require('assert');
const { Router } = require('express');
const { BadRequest, NotFound, Unauthorized } = require('http-errors');
const Busboy = require('busboy');
const { BusboyInPromiseWrapper, BusboyActionsFactory } = require('../RequestActions');
const Logger = require('../Logging/Logger');
const { ObjectId } = require('mongodb');
const TrackStreamer = require('../FileActions/TrackStreamer');
const { ITrackParser, TrackRemover } = require('../FileActions');
const Searcher = require('../SearchActions/Searcher');
const JwtManagerHS256 = require('./JwtManagerHS256');

module.exports = class TrackController {
  /**
   * @param {BusboyActionsFactory} busboyActionsFactory
   * @param {TrackStreamer} trackStreamer
   * @param {ITrackParser} trackParser
   * @param {TrackRemover} trackRemover
   * @param {Searcher} searcher
   * @param {JwtManagerHS256} jwtManager
   * @param {Logger} logger
   */
  constructor (busboyActionsFactory, trackStreamer, trackParser, trackRemover, searcher, jwtManager, logger) {
    assert.ok(busboyActionsFactory instanceof BusboyActionsFactory); this._busboyActionsFactory = busboyActionsFactory;
    assert.ok(trackStreamer instanceof TrackStreamer); this._trackStreamer = trackStreamer;
    assert.ok(trackParser instanceof ITrackParser); this._trackParser = trackParser;
    assert.ok(trackRemover instanceof TrackRemover); this._trackRemover = trackRemover;
    assert.ok(jwtManager instanceof JwtManagerHS256); this._jwtManager = jwtManager;
    assert.ok(logger instanceof Logger); this._logger = logger;
    assert.ok(searcher instanceof Searcher); this._searcher = searcher;
    this._busboyWrapper = new BusboyInPromiseWrapper(new Logger());
  }

  route () {
    const router = Router();
    router.post('/', this._postTrack.bind(this));
    router.delete('/:id', this._deleteTrack.bind(this));
    router.post('/validate', this._postValidateTrack.bind(this));
    router.get('/stream/:id', this._getStreamTrack.bind(this));
    router.get('/cover/:id', this._getAlbumCover.bind(this));
    return router;
  }

  /**
   * Uploads new track.
   * @param {import('express').NextFunction} next
   */
  async _postTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      const token = this._validateToken(req);

      const streamReaderToUploadTrack = this._busboyActionsFactory.createStreamReaderToUploadTrack(token.gitHubUserId);
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
   * Uploads new track.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async _deleteTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      if (!req.params.id || !ObjectId.isValid(req.params.id)) throw new BadRequest('Track Id is empty or invalid!');
      const trackId = new ObjectId(req.params.id);

      const removeTrackResult = await this._trackRemover.remove(trackId);
      if (!removeTrackResult.success) throw new BadRequest(removeTrackResult.message);

      res.json(removeTrackResult.deletedObjectType);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validates new track if can be uploaded.
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
  async _getAlbumCover (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      if (!req.params.id || !ObjectId.isValid(req.params.id)) throw new BadRequest('Album Id is empty or invalid!');

      const albumId = new ObjectId(req.params.id);
      const album = await this._searcher.searchById(albumId);

      const trackStream = await this._trackStreamer.getStream(album.tracks[0]._id);
      if (!trackStream) throw new NotFound();

      const trackCover = await this._trackParser.getCover(trackStream.stream, trackStream.mimetype);

      return res.json(trackCover);
    } catch (error) {
      next(error);
    }
  }

  _validateToken (req) {
    if (!req.query.jwt) throw new Unauthorized('JWT token not provided.');

    const token = this._jwtManager.parse(req.query.jwt, req.ip);
    if (!token) throw new Unauthorized('JWT token cannot be parsed and verified.');

    return token;
  }
};
