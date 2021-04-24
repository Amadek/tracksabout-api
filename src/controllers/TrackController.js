const assert = require('assert');
const { Router } = require('express');
const { BadRequest } = require('http-errors');
const Busboy = require('busboy');
const BusboyInPromiseWrapper = require('./BusboyInPromiseWrapper');
const Logger = require('./Logger');

module.exports = class TrackController {
  /**
   * @param {import('../entities/ITrackParser')} trackParser
   * @param {import('../entities/TrackUploader')} trackUploader
   * @param {import('../entities/TrackPresenceValidator')} trackPresenceValidator
   * @param {import('../entities/ArtistHierarchyUpdater')} artistHierarchyUpdater
   * @param {import('../controllers/Logger')} logger
   */
  constructor (trackParser, trackUploader, trackPresenceValidator, artistHierarchyUpdater, logger) {
    assert.ok(trackParser); this._trackParser = trackParser;
    assert.ok(trackUploader); this._trackUploader = trackUploader;
    assert.ok(trackPresenceValidator); this._trackPresenceValidator = trackPresenceValidator;
    assert.ok(artistHierarchyUpdater); this._artistHierarchyUpdater = artistHierarchyUpdater;
    assert.ok(logger); this._logger = logger;
    this._busboyWrapper = new BusboyInPromiseWrapper(new Logger());
  }

  route () {
    const router = Router();
    router.post('/', this._postTrack.bind(this));
    router.get('/validate', this._validateTrack.bind(this));
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

    Promise.resolve()
      .then(() => this._busboyWrapper.handle(req, new Busboy({ headers: req.headers }), this._uploadTrack.bind(this)))
      .then(uploadedTrackIds => {
        this._logger.log(this, `Returned fileIds = ${JSON.stringify(uploadedTrackIds)} of uploaded tracks.`);
        return res.json(uploadedTrackIds);
      })
      .catch(err => next(err));
  }

  /**
   * Validates new track if can be uploaded.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  _validateTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    Promise.resolve()
      .then(() => this._busboyWrapper.handle(req, new Busboy({ headers: req.headers }), this._parseTrack.bind(this)))
      .then(([parsedTrack]) => this._trackPresenceValidator.validate(parsedTrack))
      .then(trackExists => {
        if (trackExists) throw new BadRequest('Track with specified title already exists!');
        return res.send('OK');
      })
      .catch(err => next(err));
  }

  async _parseTrack (fileStream, _fileName, mimetype) {
    assert.ok(fileStream);
    assert.ok(mimetype);

    const parsedTrack = await this._trackParser.parse(fileStream, mimetype);
    // We do not need the stream any more so we are ending using it.
    fileStream.resume();
    return parsedTrack;
  }

  async _uploadTrack (fileStream, _fileName, mimetype) {
    assert.ok(fileStream);
    assert.ok(mimetype);

    const parsedTrack = await this._parseTrack(fileStream, null, mimetype);
    const updateArtistResult = await this._artistHierarchyUpdater.update(parsedTrack);
    if (!updateArtistResult.updated) throw new BadRequest(updateArtistResult.message);
    const uploadedTrack = await this._trackUploader.upload(parsedTrack, fileStream);

    return uploadedTrack.fileId;
  }
};
