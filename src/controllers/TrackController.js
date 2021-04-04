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
   * @param {import('../entities/ArtistHierarchyUpdater')} artistHierarchyUpdater
   * @param {import('../controllers/Logger')} logger
   */
  constructor (trackParser, trackUploader, artistHierarchyUpdater, logger) {
    assert.ok(trackParser);
    assert.ok(trackUploader);
    assert.ok(artistHierarchyUpdater);
    assert.ok(logger);
    this._trackParser = trackParser;
    this._trackUploader = trackUploader;
    this._artistHierarchyUpdater = artistHierarchyUpdater;
    this._logger = logger;
  }

  route () {
    const router = Router();
    router.post('/', this._postTrack.bind(this));
    return router;
  }

  async _postTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    const busboyWrapper = new BusboyInPromiseWrapper(new Logger());
    Promise.resolve()
      .then(() => busboyWrapper.handle(req, new Busboy({ headers: req.headers }), this._uploadTrack.bind(this)))
      .then(uploadedTrackIds => {
        this._logger.log(this, `Returned fileIds = ${JSON.stringify(uploadedTrackIds)} of uploaded tracks.`);
        return res.json(uploadedTrackIds);
      })
      .catch(err => next(err));
  }

  async _uploadTrack (fileStream, _fileName, mimetype) {
    assert.ok(fileStream);
    assert.ok(mimetype);

    const parsedTrack = await this._trackParser.parse(fileStream, mimetype);
    const updateArtistResult = await this._artistHierarchyUpdater.update(parsedTrack);
    if (!updateArtistResult.updated) throw new BadRequest(updateArtistResult.message);
    const uploadedTrack = await this._trackUploader.upload(parsedTrack, fileStream);

    return uploadedTrack.fileId;
  }
};
