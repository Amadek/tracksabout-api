/* global describe it */
const express = require('express');
const request = require('supertest');
const assert = require('assert');
const SearchController = require('../src/controllers/SearchController');
const Finder = require('../src/entities/Finder');
const Logger = require('../src/controllers/Logger');
const DbConnector = require('../src/entities/DbConnector');
const Config = require('../src/Config');
const TrackUploader = require('../src/entities/TrackUploader');
const TrackPresenceValidator = require('../src/entities/TrackPresenceValidator');
const AritstHierarchyUpdater = require('../src/entities/ArtistHierarchyUpdater');
const BusboyStreamReaderToValidateTrack = require('../src/controllers/BusboyStreamReaderToValidateTrack');
const BusboyStreamReaderToUploadTrack = require('../src/controllers/BusboyStreamReaderToUploadTrack');
const TrackController = require('../src/controllers/TrackController');
const TrackParserTest = require('./TrackParserTest');
const { ObjectID } = require('mongodb');

describe(SearchController.name, () => {
  describe('POST /', () => {
    it('should validate search phrase', async () => {
      // ARRANGE
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const dbClient = await new DbConnector(new Config()).connect();
      const app = createApp(dbClient, trackBaseData);

      // ACT, ASSERT
      await request(app)
        .post('/search/')
        .expect(404);

      await request(app)
        .post('/search/ab')
        .expect(400);

      await request(app)
        .post('/search/abc')
        .expect(200);
    }).timeout(5000);

    it('should return tracks', async () => {
      // ARRANGE
      const searchTrackPhrase = new ObjectID().toHexString();
      const trackBaseData = {
        title: searchTrackPhrase,
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const dbClient = await new DbConnector(new Config()).connect();
      let app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      trackBaseData.title += new ObjectID().toHexString();
      app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      // ACT, ASSERT
      const { searchResults } = await request(app)
        .post('/search/' + searchTrackPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      assert.strictEqual(searchResults.length, 2);
    }).timeout(5000);

    it('should return albums', async () => {
      // ARRANGE
      const searchAlbumPhrase = new ObjectID().toHexString();
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: searchAlbumPhrase,
        artistName: new ObjectID().toHexString()
      };
      const dbClient = await new DbConnector(new Config()).connect();
      let app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      trackBaseData.albumName += new ObjectID().toHexString();
      app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      // ACT, ASSERT
      const { searchResults } = await request(app)
        .post('/search/' + searchAlbumPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      assert.strictEqual(searchResults.length, 2);
    }).timeout(5000);

    it('should return artists', async () => {
      // ARRANGE
      const searchArtistPhrase = new ObjectID().toHexString();
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: searchArtistPhrase
      };
      const dbClient = await new DbConnector(new Config()).connect();
      let app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      trackBaseData.artistName += new ObjectID().toHexString();
      app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      // ACT, ASSERT
      const { searchResults } = await request(app)
        .post('/search/' + searchArtistPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      assert.strictEqual(searchResults.length, 2);
    }).timeout(5000);
  });
});

function createApp (dbClient, trackBaseData) {
  const app = express();
  app.use('/search', createSearchController(dbClient).route());
  app.use('/track', createTrackController(dbClient, trackBaseData).route());

  const logger = new Logger();
  app.use((err, _req, res, _next) => {
    logger.log('index', err);
    res.status(err.status ?? 500).send(err.stack);
  });

  return app;
}

function createSearchController (dbClient) {
  const trackFinder = new Finder(dbClient, new Logger());

  return new SearchController(trackFinder);
}

function createTrackController (dbClient, trackBaseData) {
  const trackParser = new TrackParserTest(trackBaseData);
  const trackUploader = new TrackUploader(dbClient, new Logger());
  const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
  const artistHierarchyUpdater = new AritstHierarchyUpdater(dbClient, new Logger());
  const busboyStreamReaderToValidateTrack = new BusboyStreamReaderToValidateTrack(trackParser, trackPresenceValidator, new Logger());
  const busboyStreamReaderToUploadTrack = new BusboyStreamReaderToUploadTrack(trackParser, artistHierarchyUpdater, trackUploader, new Logger());

  return new TrackController(busboyStreamReaderToUploadTrack, busboyStreamReaderToValidateTrack, new Logger());
}
