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
const { TrackPresenceValidator, TrackParser, TrackStreamer, ReversibleActionsFactory, TrackRemover } = require('../src/FileActions');
const { BusboyActionsFactory } = require('../src/RequestActions');
const SearchController = require('../src/Controllers/SearchController.js');
const TrackFieldsValidator = require('../src/FileActions/TrackFieldsValidator.js');
const LoggerFactory = require('../src/Logging/LoggerFactory.js');
const DummyJwtManager = require('./DummyJwtManager.js');

const testConfig = new TestConfig();
const config = new Config();

describe('TrackController', () => {
  describe('POST /', () => {
    it('should upload tracks to DB', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const app = createApp(dbClient, trackBaseData, config);

        // ACT
        const { trackIds } = await request(app)
          .post('/?jwt=JWT_TOKEN')
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
        assert.strictEqual(artist.albums[0].tracks[0].userId, 1);
        assert.ok(artist.albums[0].tracks[0].fileId);
        assert.ok(artist.albums[0].tracks[0].number);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should upload tracks with metadata to DB', async () => {
      const dbClient = await new DbConnector(config).connect();
      let trackIds = [];
      try {
        // ARRANGE
        const app = createApp(dbClient, null, config);
        const { size: trackFileSize } = await fsPromises.stat(testConfig.flacFilePath);

        await dbClient.db().collection('artists').deleteMany({ 'albums.tracks.title': testConfig.flacFileMetadata.title });

        // ACT
        const httpResponseBody = await request(app)
          .post('/?jwt=JWT_TOKEN')
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
        assert.strictEqual(artist.albums[0].tracks[0].userId, 1);
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
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const app = createApp(dbClient, null, config);

        // ACT
        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          // ASSERT
          .expect(400);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return BadRequest when no file was uploading', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const app = createApp(dbClient, {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        }, config);

        // ACT, ASSERT
        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .expect(400);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return Conflict when track with specified name already exists', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const app = createApp(dbClient, {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        }, config);

        // ACT, ASSERT
        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(409);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return Conflict and rollback changes when uploading duplicate tracks', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const app = createApp(dbClient, trackBaseData, config);

        // ACT, ASSERT
        await request(app)
          .post('/?jwt=JWT_TOKEN')
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

    it('should return Unauthorised when JWT token not provided in query', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const app = createApp(dbClient, null, config);

        // ACT
        await request(app)
          .post('/')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          // ASSERT
          .expect(401);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);
  });

  describe('DELETE /', () => {
    it('should remove artist when has only one album with one track', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString(),
          cover: {}
        };
        const app = createApp(dbClient, trackBaseData, config);

        const { trackIds } = await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        const artist = await dbClient.db().collection('artists')
          .findOne({ 'albums.tracks.fileId': new ObjectId(trackIds[0]) });

        // ACT
        const { deletedObjectType } = await request(app)
          .delete('/' + artist.albums[0].tracks[0]._id + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ deletedObjectType: body }));

        // ASSERT
        assert.strictEqual(deletedObjectType, 'artist');
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should remove album with one track from artist with multiple albums', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString(),
          cover: {}
        };
        const app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        trackBaseData.title = new ObjectId().toHexString();
        trackBaseData.albumName = new ObjectId().toHexString();

        const { trackIds } = await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        const artist = await dbClient.db().collection('artists')
          .findOne({ 'albums.tracks.fileId': new ObjectId(trackIds[0]) });

        // ACT
        const { deletedObjectType } = await request(app)
          .delete('/' + artist.albums[0].tracks[0]._id + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ deletedObjectType: body }));

        // ASSERT
        assert.strictEqual(deletedObjectType, 'album');
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should remove album with one track from artist with multiple albums', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString(),
          cover: {}
        };
        const app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        trackBaseData.title = new ObjectId().toHexString();

        const { trackIds } = await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        const artist = await dbClient.db().collection('artists')
          .findOne({ 'albums.tracks.fileId': new ObjectId(trackIds[0]) });

        // ACT
        const { deletedObjectType } = await request(app)
          .delete('/' + artist.albums[0].tracks[0]._id + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ deletedObjectType: body }));

        // ASSERT
        assert.strictEqual(deletedObjectType, 'track');
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return Bad Request when user does not own track to delete', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString(),
          cover: {}
        };
        const jwtManagerSimulationConfig = { gitHubUserId: 1 };
        const app = createApp(dbClient, trackBaseData, config, jwtManagerSimulationConfig);

        const { trackIds } = await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackIds: body }));

        jwtManagerSimulationConfig.gitHubUserId = 2;

        const artist = await dbClient.db().collection('artists')
          .findOne({ 'albums.tracks.fileId': new ObjectId(trackIds[0]) });

        // ACT, ASERT
        await request(app)
          .delete('/' + artist.albums[0].tracks[0]._id + '?jwt=JWT_TOKEN')
          .expect(400);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);
  });

  describe('POST /validate', () => {
    it('should return OK when track has not artist yet in database', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString(),
          cover: {}
        };
        const app = createApp(dbClient, trackBaseData, config);

        // ACT, ASSERT
        const parsedTrack = await request(app)
          .post('/validate?jwt=JWT_TOKEN')
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
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const existingTrack = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString(),
          cover: {}
        };
        const newTrack = {
          title: new ObjectId().toHexString(),
          albumName: existingTrack.albumName,
          artistName: existingTrack.artistName,
          cover: {}
        };
        let app = createApp(dbClient, existingTrack, config);

        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' });

        app = createApp(dbClient, newTrack, config);

        // ACT, ASSERT
        const parsedTrack = await request(app)
          .post('/validate?jwt=JWT_TOKEN')
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
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const existingTrack = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString(),
          cover: {}
        };
        const newTrack = {
          title: existingTrack.title,
          albumName: existingTrack.albumName,
          artistName: existingTrack.artistName,
          cover: {}
        };
        let app = createApp(dbClient, existingTrack, config);

        await request(app)
          .post('/?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' });

        app = createApp(dbClient, newTrack, config);

        // ACT, ASSERT
        await request(app)
          .post('/validate?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(409);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return Bad Request when track has not cover', async () => {
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
          /* cover: {} */
        };
        const app = createApp(dbClient, trackBaseData, config);

        // ACT, ASSERT
        await request(app)
          .post('/validate?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('flac', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' });
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

  describe('GET cover/:id', () => {
    it('should get cover from album', async () => {
      const dbClient = await new DbConnector(config).connect();
      let trackFileIds = [];
      try {
        // ARRANGE
        const app = createApp(dbClient, null, config);

        await dbClient.db().collection('artists').deleteMany({ 'albums.tracks.title': testConfig.flacFileMetadata.title });

        const httpResponseBody = await request(app)
          .post('/?jwt=JWT_TOKEN')
          .timeout(testConfig.uploadFlacFileTestTimeout)
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.flacFilePath, { contentType: 'audio/flac' })
          .expect(200)
          .then(({ body }) => ({ trackFileIds: body }));

        trackFileIds = httpResponseBody.trackFileIds;

        const { trackSearchResults } = await request(app)
          .get('/search/' + testConfig.flacFileMetadata.title + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ trackSearchResults: body }));

        // ACT
        const { cover } = await request(app)
          .get('/cover/' + trackSearchResults[0].albumId + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ cover: body }));

        // ASSERT
        assert.ok(typeof cover.format === 'string');
        assert.ok(typeof cover.data === 'string');
      } finally {
        await dbClient.db().collection('artists').deleteMany({ 'albums.tracks._id': new ObjectId(trackFileIds[0]) });
        await dbClient.close();
      }
    }).timeout(testConfig.uploadFlacFileTestTimeout * 2);
  });
});

function createApp (dbClient, trackBaseData, config, jwtManagerSimulationConfig) {
  const app = express();
  const loggerFactory = new LoggerFactory();
  const jwtManager = new DummyJwtManager(config, loggerFactory, jwtManagerSimulationConfig);
  const trackStreamer = new TrackStreamer(new Searcher(dbClient, new Logger()), dbClient, new Logger());
  const trackParser = trackBaseData ? new TrackParserTest(trackBaseData) : new TrackParser(new Logger());
  const trackRemover = new TrackRemover(dbClient, loggerFactory);
  const trackFieldsValidator = new TrackFieldsValidator(new Logger());
  const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
  const reversibleActionsFactory = new ReversibleActionsFactory(dbClient);
  const busboyActionsFactory = new BusboyActionsFactory(trackParser, trackFieldsValidator, trackPresenceValidator, reversibleActionsFactory);
  const searcher = new Searcher(dbClient, new Logger());
  const trackController = new TrackController(busboyActionsFactory, trackStreamer, trackParser, trackRemover, searcher, jwtManager, new Logger());
  const searchController = new SearchController(searcher, jwtManager);

  app.use('/', trackController.route());
  app.use('/search', searchController.route());

  const logger = new Logger();
  app.use((err, _req, res, _next) => {
    logger.log('index', err);
    res.status(err.status ?? 500).send(err.stack);
  });

  return app;
}
