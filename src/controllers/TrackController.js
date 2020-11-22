const assert = require('assert');
const { Router } = require('express');
const TrackUploader = require('../entities/TrackUploader');

module.exports = class TrackController {
  constructor (db) {
    assert.ok(db);
    this._db = db;
    this._trackUploader = new TrackUploader(db);
  }

  route () {
    const router = Router();
    router.post('/', this._postTrack.bind(this));
    return router;
  }

  _postTrack (request, response, next) {
    assert.ok(request);
    assert.ok(request.files);
    assert.ok(request.files.track);

    const track = {};
    const trackBuffer = request.files.track.data;

    Promise.resolve()
      .then(() => this._trackUploader.upload(track, trackBuffer))
      .then(() => console.log(JSON.stringify(track)))
      .then(() => response.status(200).send('OK'))
      .catch(err => next(err));
  }
};
