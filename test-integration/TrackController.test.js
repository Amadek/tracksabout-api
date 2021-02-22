/* global describe it before */
const express = require('express');
const TrackController = require('../src/controllers/TrackController');
const DbConnector = require('../src/entities/DbConnector.js');
const request = require('supertest');

describe('TrackController', () => {
  let app;
  before(done => {
    Promise.resolve()
      .then(() => new DbConnector().connect())
      .then(db => {
        app = express();
        app.use('/', new TrackController(db, createTrackParser()).route());
        done();
      });
  });

  describe('POST /', () => {
    it('should upload track to DB', done => {
      request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200, done);
    });
  });
});

/**
 * We need to mock TrackParser beacause we cannot create file with metadata.
 */
function createTrackParser () {
  return {
    parse: () => ({
      artist: 'artist',
      title: 'title',
      album: 'album',
      year: 1998,
      mimeType: 'audio/flac'
    })
  };
}
