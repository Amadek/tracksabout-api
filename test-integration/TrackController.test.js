/* global describe it */
const express = require('express');
const request = require('supertest');
const { ObjectID } = require('mongodb');
const DbConnector = require('../src/entities/DbConnector.js');
const TrackController = require('../src/controllers/TrackController');
const TrackUploader = require('../src/entities/TrackUploader');
const AritstHierarchyUpdater = require('../src/entities/ArtistHierarchyUpdater');
const Logger = require('../src/controllers/Logger');

describe('TrackController', () => {
  describe('POST /', () => {
    it('should upload track to DB', done => {
      Promise.resolve()
        .then(() => new DbConnector().connect())
        .then(db => {
          const app = express();
          app.use('/', new TrackController(createTrackParser(), new TrackUploader(db, new Logger()), new AritstHierarchyUpdater(db, new Logger()), new Logger()).route());
          return app;
        })
        .then(app => {
          request(app)
            .post('/')
            .set('Content-type', 'multipart/form-data')
            .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
            .expect(200, done);
        })
        .catch(err => done(err));
    }).timeout(5000);
    it('should return BadRequest when track with specified name already exists', done => {
      Promise.resolve()
        .then(() => new DbConnector().connect())
        .then(db => {
          const app = express();
          const trackParser = createTrackParser({
            title: new ObjectID().toHexString(),
            albumName: new ObjectID().toHexString(),
            artistName: new ObjectID().toHexString()
          });
          app.use('/', new TrackController(trackParser, new TrackUploader(db, new Logger()), new AritstHierarchyUpdater(db, new Logger()), new Logger()).route());
          return app;
        })
        .then(app => {
          return request(app)
            .post('/')
            .set('Content-type', 'multipart/form-data')
            .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
            .expect(200)
            .then(() => app);
        })
        .then(app => {
          app.use((err, _req, res, _next) => {
            // Suppressing 400 error in output.
            if (err.status !== 400) console.error(err);
            res.status(err.status).end();
          });
          return request(app)
            .post('/')
            .set('Content-type', 'multipart/form-data')
            .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
            .expect(400);
        })
        .then(() => done())
        .catch(err => done(err));
    }).timeout(5000);
  });
});

/**
 * We need to mock TrackParser because we cannot create file with metadata.
 */
function createTrackParser (trackBaseData) {
  return {
    parse: (fileStream, _mimetype) => Promise.resolve({
      artistName: trackBaseData?.artistName ?? new ObjectID().toHexString(),
      title: trackBaseData?.title ?? new ObjectID().toHexString(),
      albumName: trackBaseData?.albumName ?? new ObjectID().toHexString(),
      year: 1998,
      mimetype: 'audio/flac',
      fileStream: fileStream
    })
  };
}
