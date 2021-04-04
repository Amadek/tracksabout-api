/* global describe it */
const assert = require('assert');
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
    it('should upload tracks to DB', async () => {
      // ARRANGE
      const dbClient = await new DbConnector().connect();
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const app = createApp(dbClient, trackBaseData);

      // ACT
      const { trackIds } = await request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200)
        .then(({ body }) => ({ trackIds: body }));

      // ASSERT
      assert.ok(Array.isArray(trackIds));

      const artist = await dbClient.db().collection('artists')
        .findOne({ 'albums.tracks.fileId': new ObjectID(trackIds[0]) });

      assert.ok(artist);
      assert.strictEqual(artist.name, trackBaseData.artistName);
      assert.strictEqual(artist.albums.length, 1);
      assert.strictEqual(artist.albums[0].name, trackBaseData.albumName);
      assert.strictEqual(artist.albums[0].tracks.length, 1);
      assert.strictEqual(artist.albums[0].tracks[0].title, trackBaseData.title);
      assert.ok(artist.albums[0].tracks[0].fileId);
    }).timeout(5000);

    it('should return BadRequest when track with specified name already exists', async () => {
      // ARRANGE
      const dbClient = await new DbConnector().connect();
      const app = createApp(dbClient, {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      });

      // ACT, ASSERT
      await request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      await request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(400);
    }).timeout(5000);

    it('should return BadRequest when uploading duplicate tracks', async () => {
      // TODO trzeba zrobić lepszą obsługę błędów żeby przerwać operacje uplodowania pierwszego pliku.
      // ARRANGE
      const dbClient = await new DbConnector().connect();
      const app = createApp(dbClient, {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      });

      // ACT, ASSERT
      await request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(400);
    }).timeout(5000);
  });
});

function createApp (dbClient, trackBaseData) {
  const app = express();
  const uploader = new TrackUploader(dbClient, new Logger());
  const updater = new AritstHierarchyUpdater(dbClient, new Logger());
  const controller = new TrackController(createTrackParser(trackBaseData), uploader, updater, new Logger());
  app.use('/', controller.route());

  const logger = new Logger();
  app.use((err, _req, res, _next) => {
    logger.log('index', err);
    res.status(err.status ?? 500).send(err.stack);
  });

  return app;
}

/**
 * We need to mock TrackParser because we cannot create unique file with metadata every time when test starts.
 */
function createTrackParser (trackBaseData) {
  return {
    parse: (_fileStream, _mimetype) => Promise.resolve({
      artistName: trackBaseData?.artistName ?? new ObjectID().toHexString(),
      title: trackBaseData?.title ?? new ObjectID().toHexString(),
      albumName: trackBaseData?.albumName ?? new ObjectID().toHexString(),
      year: 1998,
      mimetype: 'audio/flac'
    })
  };
}
