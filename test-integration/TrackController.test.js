/* global describe it */
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { ObjectId } = require('mongodb');
const DbConnector = require('../src/DbConnector.js');
const TrackController = require('../src/Controllers/TrackController');
const Logger = require('../src/Logging/Logger');
const Config = require('../src/Config');
const TrackParserTest = require('./TrackParserTest');
const Searcher = require('../src/SearchActions/Searcher');
const TestConfig = require('./TestConfig');
const fsPromises = require('fs/promises');
const { TrackPresenceValidator, TrackParser, TrackStreamer, ReversibleActionsFactory } = require('../src/FileActions');
const { BusboyActionsFactory } = require('../src/RequestActions');

const testConfig = new TestConfig();

describe('TrackController', () => {
  describe('POST /', () => {
    it('should upload tracks to DB', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const app = createApp(dbClient, trackBaseData);

        // ACT
        const { trackIds } = await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        // ASSERT
        assert.ok(Array.isArray(trackIds));

        const artist = await dbClient.db().collection('artists')
          .findOne({ 'albums.tracks.fileId': new ObjectId(trackIds[0]) });

        assert.ok(artist);
        assert.strictEqual(artist.name, trackBaseData.artistName);
        assert.strictEqual(artist.albums.length, 1);
        assert.strictEqual(artist.albums[0].name, trackBaseData.albumName);
        assert.strictEqual(artist.albums[0].tracks.length, 1);
        assert.strictEqual(artist.albums[0].tracks[0].title, trackBaseData.title);
        assert.ok(artist.albums[0].tracks[0].fileId);
        assert.ok(artist.albums[0].tracks[0].number);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should upload tracks with metadata to DB', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      let trackIds = [];
      try {
        // ARRANGE
        const app = createApp(dbClient);
        const { size: trackFileSize } = await fsPromises.stat(testConfig.flacFilePath);

        await dbClient.db().collection('artists').deleteMany({ 'albums.tracks.title': testConfig.flacFileMetadata.title });

        // ACT
        const httpResponseBody = await request(app)
          .post('/')
          .timeout(testConfig.uploadFlacFileTestTimeout)
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.flacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        trackIds = httpResponseBody.trackIds;

        // ASSERT
        assert.ok(Array.isArray(trackIds));

        const artist = await dbClient.db().collection('artists')
          .findOne({ 'albums.tracks.fileId': new ObjectId(trackIds[0]) });

        assert.ok(artist);
        assert.strictEqual(artist.name, testConfig.flacFileMetadata.artistName);
        assert.strictEqual(artist.albums.length, 1);
        assert.strictEqual(artist.albums[0].name, testConfig.flacFileMetadata.albumName);
        assert.strictEqual(artist.albums[0].tracks.length, 1);
        assert.strictEqual(artist.albums[0].tracks[0].title, testConfig.flacFileMetadata.title);
        assert.ok(artist.albums[0].tracks[0].fileId);
        assert.ok(artist.albums[0].tracks[0].number);

        const { length: trackFileSizeFromDb } = await dbClient.db().collection('tracks.files').findOne({ _id: artist.albums[0].tracks[0].fileId });
        assert.strictEqual(trackFileSizeFromDb, trackFileSize);
      } finally {
        await dbClient.db().collection('artists').deleteMany({ 'albums.tracks._id': new ObjectId(trackIds[0]) });
        await dbClient.close();
      }
    }).timeout(testConfig.uploadFlacFileTestTimeout * 2);

    it('should return Bad Request when track is not a valid FLAC', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const app = createApp(dbClient);

        // ACT
        await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          // ASSERT
          .expect(400);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return BadRequest when no file was uploading', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const app = createApp(dbClient, {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        });

        // ACT, ASSERT
        await request(app)
          .post('/')
          .expect(400);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return Conflict when track with specified name already exists', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const app = createApp(dbClient, {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        });

        // ACT, ASSERT
        await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(409);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return Conflict and rollback changes when uploading duplicate tracks', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const app = createApp(dbClient, trackBaseData);

        // ACT, ASSERT
        await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.flacFilePath, { contentType: 'audio/flac' })
          .attach('flac', testConfig.flacFilePath, { contentType: 'audio/flac' })
          .expect(409);

        const artistsCount = await dbClient.db().collection('artists')
          .countDocuments({ name: trackBaseData.artistName });
        assert.strictEqual(artistsCount, 0);

        const trackFilesCount = await dbClient.db().collection('tracks.files').countDocuments({ metadata: { title: trackBaseData.title } });
        assert.strictEqual(trackFilesCount, 0);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.uploadFlacFileTestTimeout);
  });

  describe('POST /validate', () => {
    it('should return OK when track has not artist yet in database', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const app = createApp(dbClient, trackBaseData);

        // ACT, ASSERT
        const parsedTrack = await request(app)
          .post('/validate')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => body);

        assert.strictEqual(parsedTrack.title, trackBaseData.title);
        assert.strictEqual(parsedTrack.albumName, trackBaseData.albumName);
        assert.strictEqual(parsedTrack.artistName, trackBaseData.artistName);
        assert.ok(parsedTrack.number);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return OK when track has not artist\'s album yet in database', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const existingTrack = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const newTrack = {
          title: new ObjectId().toHexString(),
          albumName: existingTrack.albumName,
          artistName: existingTrack.artistName
        };
        let app = createApp(dbClient, existingTrack);

        await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' });

        app = createApp(dbClient, newTrack);

        // ACT, ASSERT
        const parsedTrack = await request(app)
          .post('/validate')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => body);

        assert.strictEqual(parsedTrack.title, newTrack.title);
        assert.strictEqual(parsedTrack.albumName, newTrack.albumName);
        assert.strictEqual(parsedTrack.artistName, newTrack.artistName);
        assert.ok(parsedTrack.number);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return Conflict when track already exists in artist\'s album in database', async () => {
      const dbClient = await new DbConnector(new Config()).connect();
      try {
        // ARRANGE
        const existingTrack = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const newTrack = {
          title: existingTrack.title,
          albumName: existingTrack.albumName,
          artistName: existingTrack.artistName
        };
        let app = createApp(dbClient, existingTrack);

        await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' });

        app = createApp(dbClient, newTrack);

        // ACT, ASSERT
        await request(app)
          .post('/validate')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(409);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);
  });

  describe('GET /stream/:id', () => {
    it('should work?', () => {
      // TODO Narazie nie mam pomysłu jak to testować. Może sprawa się wyjaśni po implementacji po stronie kliena.
      // Na pewn można posprawdzać czy żądanie ostatecznie się wykona pozytywnie.
    });
  });
});

function createApp (dbClient, trackBaseData) {
  const app = express();
  const trackStreamer = new TrackStreamer(new Searcher(dbClient, new Logger()), dbClient, new Logger());
  const trackParser = trackBaseData ? new TrackParserTest(trackBaseData) : new TrackParser(new Logger());
  const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
  const reversibleActionsFactory = new ReversibleActionsFactory(dbClient);
  const busboyActionsFactory = new BusboyActionsFactory(trackParser, trackPresenceValidator, reversibleActionsFactory);
  const controller = new TrackController(busboyActionsFactory, trackStreamer, new Logger());
  app.use('/', controller.route());

  const logger = new Logger();
  app.use((err, _req, res, _next) => {
    logger.log('index', err);
    res.status(err.status ?? 500).send(err.stack);
  });

  return app;
}
