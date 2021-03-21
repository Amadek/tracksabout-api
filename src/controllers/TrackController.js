const assert = require('assert');
const { Router } = require('express');
const Busboy = require('busboy');
const { BadRequest } = require('http-errors');

module.exports = class TrackController {
  constructor (trackParser, trackUploader, artistHierarchyUpdater) {
    assert.ok(trackParser);
    assert.ok(trackUploader);
    assert.ok(artistHierarchyUpdater);
    this._trackParser = trackParser;
    this._trackUploader = trackUploader;
    this._artistHierarchyUpdater = artistHierarchyUpdater;
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
        // Multiple files handling. Collects all upload track promises and waits for all of them on busboy.finish.
        // File event triggers on every file, but finish event triggers only once.
        // Only one file stream is opened at once. We have to handle first file stream to move on to second file stream.
        const fileStream = file;
        const uploadTrackPromise = this._trackParser.parse(fileStream, mimetype)
          .then(parsedTrack => this._artistHierarchyUpdater.update(parsedTrack))
          .then(updateArtistResult => {
            if (!updateArtistResult.updated) throw new BadRequest(updateArtistResult.message);
            return updateArtistResult.sourceTrack;
          })
          .then(parsedTrack => this._trackUploader.upload(parsedTrack))
          // We catch error here because:
          // 1. Promise.all in busboy.onFinish is created after busboy.onFile ends, which ends on end of stream.
          //    Before file stream ends, if error occur there would be no error handling.
          //    Promise.all would not be created. Noone waits or catch errors in created Promise.
          // 2. When error is catched here, we need to rethrow it to notify Promise.all to do nothing, because error is already handled.
          //    next() method not abort request handling, it is asynchronous. When next() invoked request handling, it is still going on.
          .catch(err => { next(err); throw err; });

        uploadTrackPromises.push(uploadTrackPromise);
      })
      .on('finish', () => {
        console.log('TrackController:Busboy - last file stream ends.');
        Promise.all(uploadTrackPromises)
          .catch(err => { err.occuredInUploading = true; throw err; })
          .then(() => console.log('TrackController - POST / ends.'))
          .then(() => res.send('OK'))
          .catch(err => {
            if (err.occuredInUploading) return;
            next(err);
          });
      })
      .on('error', err => next(err));

    req.pipe(busboy);
  }
};
