const assert = require('assert');
const { Router } = require('express');
const { BadRequest } = require('http-errors');
const Busboy = require('busboy');
const BusboyInPromiseWrapper = require('./BusboyInPromiseWrapper');
const Logger = require('./Logger');

module.exports = class TrackController {
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

  _postTrack (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    const busboyWrapper = new BusboyInPromiseWrapper(new Logger());
    Promise.resolve()
      .then(() => busboyWrapper.handle(req, new Busboy({ headers: req.headers }), this._uploadTrack.bind(this)))
      .then(() => res.send('OK'))
      .catch(err => next(err));
  }

  _uploadTrack (fileStream, _fileName, mimetype) {
    assert.ok(fileStream);
    assert.ok(mimetype);

    return Promise.resolve()
      .then(() => this._trackParser.parse(fileStream, mimetype))
      .then(parsedTrack => this._artistHierarchyUpdater.update(parsedTrack))
      .then(updateArtistResult => {
        if (!updateArtistResult.updated) throw new BadRequest(updateArtistResult.message);
        return updateArtistResult.sourceTrack;
      })
      .then(parsedTrack => this._trackUploader.upload(parsedTrack, fileStream));
  }
};
