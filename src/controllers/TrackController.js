const assert = require('assert');
const { Router } = require('express');
const TrackUploader = require('../entities/TrackUploader');
const Busboy = require('busboy');

module.exports = class TrackController {
  constructor (db, trackParser) {
    assert.ok(db);
    assert.ok(trackParser);
    this._db = db;
    this._trackParser = trackParser;
    this._trackUploader = new TrackUploader(db);
  }

  route () {
    const router = Router();
    router.post('/', this._postTrack.bind(this));
    return router;
  }

  _postTrack (req, res, next) {
    console.log('TrackController - POST / begins.');
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    const uploadTrackPromises = [];

    const busboy = new Busboy({ headers: req.headers });
    busboy
      .on('file', (_fieldname, file, filename, _encoding, mimetype) => {
        console.log(`TrackController:Busboy - file ${filename} stream begins.`);
        const readTrackStream = file;
        // Multiple files handling. Collects all upload track promises and waits for all of them on busboy.finish.
        // file event triggers on every file, but finish event triggers only once.
        const uploadTrackPromise = Promise.resolve()
          .then(() => this._trackParser.parse(readTrackStream, mimetype))
          .then(track => this._trackUploader.upload(readTrackStream, track));

        uploadTrackPromises.push(uploadTrackPromise);
      })
      .on('finish', () => {
        console.log('TrackController:Busboy - file stream ends.');
        Promise.all(uploadTrackPromises)
          .then(() => console.log('TrackController - POST / ends.'))
          .then(() => res.send('OK'))
          .catch(err => next(err));
      });

    req.pipe(busboy);
  }
};
