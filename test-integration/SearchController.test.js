/* global describe it */
const express = require('express');
const request = require('supertest');
const assert = require('assert');
const SearchController = require('../src/Controllers/SearchController');
const Searcher = require('../src/SearchActions/Searcher');
const Logger = require('../src/Logging/Logger');
const DbConnector = require('../src/DbConnector');
const Config = require('../src/Config');
const TrackController = require('../src/Controllers/TrackController');
const TrackParserTest = require('./TrackParserTest');
const { ObjectId } = require('mongodb');
const SearchResultType = require('../src/SearchActions/SearchResultType');
const TestConfig = require('./TestConfig');
const { TrackPresenceValidator, TrackStreamer, ReversibleActionsFactory } = require('../src/FileActions');
const { BusboyActionsFactory } = require('../src/RequestActions');
const TrackFieldsValidator = require('../src/FileActions/TrackFieldsValidator');
const LoggerFactory = require('../src/Logging/LoggerFactory');
const DummyJwtManager = require('./DummyJwtManager');

const testConfig = new TestConfig();

describe(SearchController.name, () => {
  describe('GET /search/:phrase', () => {
    it('should validate search phrase', async () => {
      const config = new Config();
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
          .get('/search/?jwt=JWT_TOKEN')
          .expect(404);

        await request(app)
          .get('/search/ab?jwt=JWT_TOKEN')
          .expect(400);

        await request(app)
          .get('/search/abc?jwt=JWT_TOKEN')
          .expect(200);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return tracks', async () => {
      const config = new Config();
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const searchTrackPhrase = new ObjectId().toHexString();
        const trackBaseData = {
          title: searchTrackPhrase,
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        let app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        trackBaseData.title += new ObjectId().toHexString();
        app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        // ACT, ASSERT
        const { searchResults } = await request(app)
          .get('/search/' + searchTrackPhrase + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchResults: body }));

        assert.strictEqual(searchResults.length, 2);
        assert.ok(searchResults.every(t => t.type === SearchResultType.track));
        assert.ok(searchResults.find(t => t.title === searchTrackPhrase));
        assert.ok(searchResults.find(t => t.title === trackBaseData.title));
        assert.ok(searchResults.every(t => ObjectId.isValid(t.albumId)));
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return albums', async () => {
      const config = new Config();
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const searchAlbumPhrase = new ObjectId().toHexString();
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: searchAlbumPhrase,
          artistName: new ObjectId().toHexString()
        };
        let app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        trackBaseData.albumName += new ObjectId().toHexString();
        app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        // ACT, ASSERT
        const { searchResults } = await request(app)
          .get('/search/' + searchAlbumPhrase + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchResults: body }));

        assert.strictEqual(searchResults.length, 2);
        assert.ok(searchResults.every(a => a.type === SearchResultType.album));
        assert.ok(searchResults.find(a => a.title === searchAlbumPhrase));
        assert.ok(searchResults.find(a => a.title === trackBaseData.albumName));
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return artists', async () => {
      const config = new Config();
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const searchArtistPhrase = new ObjectId().toHexString();
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: searchArtistPhrase
        };
        let app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        trackBaseData.artistName += new ObjectId().toHexString();
        app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        // ACT, ASSERT
        const { searchResults } = await request(app)
          .get('/search/' + searchArtistPhrase + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchResults: body }));

        assert.strictEqual(searchResults.length, 2);
        assert.ok(searchResults.every(a => a.type === SearchResultType.artist));
        assert.ok(searchResults.find(a => a.title === searchArtistPhrase));
        assert.ok(searchResults.find(a => a.title === trackBaseData.artistName));
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should ignore case sensitivity', async () => {
      const config = new Config();
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const searchTrackPhrase = new ObjectId().toHexString();
        const trackBaseData = {
          title: searchTrackPhrase,
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        let app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        trackBaseData.title += new ObjectId().toHexString();
        app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        // ACT, ASSERT
        const { searchResults } = await request(app)
          .get('/search/' + searchTrackPhrase.toUpperCase() + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchResults: body }));

        assert.strictEqual(searchResults.length, 2);
        assert.ok(searchResults.every(t => t.type === SearchResultType.track));
        assert.ok(searchResults.find(t => t.title === searchTrackPhrase));
        assert.ok(searchResults.find(t => t.title === trackBaseData.title));
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);
  });

  describe('GET /search/id/:id', () => {
    it('should return track by id', async () => {
      const config = new Config();
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const searchTrackPhrase = new ObjectId().toHexString();
        const trackBaseData = {
          title: searchTrackPhrase,
          albumName: new ObjectId().toHexString(),
          artistName: new ObjectId().toHexString()
        };
        const app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        const { searchResults } = await request(app)
          .get('/search/' + searchTrackPhrase + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchResults: body }));

        const uploadedTrack = searchResults[0];

        // ACT
        const { searchByIdResult } = await request(app)
          .get('/search/id/' + uploadedTrack._id + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchByIdResult: body }));

        assert.ok(searchByIdResult);
        assert.strictEqual(searchByIdResult._id, uploadedTrack._id);
        assert.strictEqual(searchByIdResult.type, SearchResultType.track);
        assert.strictEqual(searchByIdResult.title, trackBaseData.title);
        assert.strictEqual(searchByIdResult.albumName, trackBaseData.albumName);
        assert.strictEqual(searchByIdResult.artistName, trackBaseData.artistName);
        assert.ok(searchByIdResult.fileId);
        assert.ok(searchByIdResult.year);
        assert.ok(Number.isInteger(searchByIdResult.number));
        assert.ok(searchByIdResult.mimetype);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return album by id', async () => {
      const config = new Config();
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const searchAlbumPhrase = new ObjectId().toHexString();
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: searchAlbumPhrase,
          artistName: new ObjectId().toHexString()
        };
        const app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        const { searchResults } = await request(app)
          .get('/search/' + searchAlbumPhrase + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchResults: body }));

        const uploadedAlbum = searchResults[0];

        // ACT
        const { searchByIdResult } = await request(app)
          .get('/search/id/' + uploadedAlbum._id + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchByIdResult: body }));

        assert.ok(searchByIdResult);
        assert.strictEqual(searchByIdResult._id, uploadedAlbum._id);
        assert.strictEqual(searchByIdResult.type, SearchResultType.album);
        assert.strictEqual(searchByIdResult.name, trackBaseData.albumName);
        assert.strictEqual(searchByIdResult.artistName, trackBaseData.artistName);
        assert.ok(searchByIdResult.year);
        assert.ok(searchByIdResult.tracks);
        assert.ok(searchByIdResult.tracks?.length > 0);

        assert.ok(searchByIdResult.tracks[0]);
        assert.strictEqual(searchByIdResult.tracks[0].title, trackBaseData.title);
        assert.strictEqual(searchByIdResult.tracks[0].albumId, searchByIdResult._id);
        assert.ok(searchByIdResult.tracks[0].fileId);
        assert.ok(searchByIdResult.tracks[0].mimetype);
        assert.ok(Number.isInteger(searchByIdResult.tracks[0].number));
        assert.ok(searchByIdResult.artistId);
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);

    it('should return artist by id', async () => {
      const config = new Config();
      const dbClient = await new DbConnector(config).connect();
      try {
        // ARRANGE
        const searchArtistPhrase = new ObjectId().toHexString();
        const trackBaseData = {
          title: new ObjectId().toHexString(),
          albumName: new ObjectId().toHexString(),
          artistName: searchArtistPhrase
        };
        const app = createApp(dbClient, trackBaseData, config);

        await request(app)
          .post('/track?jwt=JWT_TOKEN')
          .set('Content-type', 'multipart/form-data')
          .attach('file1', testConfig.fakeFlacFilePath, { contentType: 'audio/flac' })
          .expect(200);

        const { searchResults } = await request(app)
          .get('/search/' + searchArtistPhrase + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchResults: body }));

        const uploadedArtist = searchResults[0];

        // ACT
        const { searchByIdResult } = await request(app)
          .get('/search/id/' + uploadedArtist._id + '?jwt=JWT_TOKEN')
          .expect(200)
          .then(({ body }) => ({ searchByIdResult: body }));

        assert.ok(searchByIdResult);
        assert.strictEqual(searchByIdResult._id, uploadedArtist._id);
        assert.strictEqual(searchByIdResult.type, SearchResultType.artist);
        assert.strictEqual(searchByIdResult.name, trackBaseData.artistName);
        assert.ok(searchByIdResult.albums);
        assert.strictEqual(searchByIdResult.albums[0].name, trackBaseData.albumName);
        assert.ok(searchByIdResult.albums[0].year);
        assert.strictEqual(searchByIdResult.albums[0].tracks, undefined, "we don't want to send tracks of artist's album, only album's data");
      } finally {
        await dbClient.close();
      }
    }).timeout(testConfig.testRunTimeout);
  });
});

function createApp (dbClient, trackBaseData, config) {
  const app = express();
  app.use('/search', createSearchController(dbClient, config).route());
  app.use('/track', createTrackController(dbClient, trackBaseData, config).route());

  const logger = new Logger();
  app.use((err, _req, res, _next) => {
    logger.log('index', err);
    res.status(err.status ?? 500).send(err.stack);
  });

  return app;
}

function createSearchController (dbClient, config) {
  const loggerFactory = new LoggerFactory();
  const jwtManager = new DummyJwtManager(config, loggerFactory);
  const searcher = new Searcher(dbClient, new Logger());

  return new SearchController(searcher, jwtManager);
}

function createTrackController (dbClient, trackBaseData, config) {
  const loggerFactory = new LoggerFactory();
  const trackParser = new TrackParserTest(trackBaseData);
  const trackStreamer = new TrackStreamer(new Searcher(dbClient, new Logger()), dbClient, new Logger());
  const trackFieldsValidator = new TrackFieldsValidator(new Logger());
  const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
  const reversibleActionsFactory = new ReversibleActionsFactory(dbClient);
  const busboyActionsFactory = new BusboyActionsFactory(trackParser, trackFieldsValidator, trackPresenceValidator, reversibleActionsFactory);
  const jwtManager = new DummyJwtManager(config, loggerFactory);
  const searcher = new Searcher(dbClient, new Logger());

  return new TrackController(busboyActionsFactory, trackStreamer, trackParser, searcher, jwtManager, new Logger());
}
