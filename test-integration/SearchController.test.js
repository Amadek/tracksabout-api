/* global describe it */
const express = require('express');
const request = require('supertest');
const assert = require('assert');
const SearchController = require('../src/Controllers/SearchController');
const Searcher = require('../src/Searcher/Searcher');
const Logger = require('../src/Controllers/Logger');
const DbConnector = require('../src/DbConnector');
const Config = require('../src/Config');
const TrackUploader = require('../src/TrackUploader');
const TrackPresenceValidator = require('../src/TrackPresenceValidator');
const AritstHierarchyUpdater = require('../src/ArtistHierarchyUpdater');
const BusboyStreamReaderToValidateTrack = require('../src/Controllers/BusboyStreamReaderToValidateTrack');
const BusboyStreamReaderToUploadTrack = require('../src/Controllers/BusboyStreamReaderToUploadTrack');
const TrackController = require('../src/Controllers/TrackController');
const TrackParserTest = require('./TrackParserTest');
const { ObjectID } = require('mongodb');
const SearchResultType = require('../src/Searcher/SearchResultType');

describe(SearchController.name, () => {
  describe('GET /search/:phrase', () => {
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
        .get('/search/')
        .expect(404);

      await request(app)
        .get('/search/ab')
        .expect(400);

      await request(app)
        .get('/search/abc')
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
        .get('/search/' + searchTrackPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      assert.strictEqual(searchResults.length, 2);
      assert.ok(searchResults.every(t => t.type === SearchResultType.track));
      assert.ok(searchResults.find(t => t.title === searchTrackPhrase));
      assert.ok(searchResults.find(t => t.title === trackBaseData.title));
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
        .get('/search/' + searchAlbumPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      assert.strictEqual(searchResults.length, 2);
      assert.ok(searchResults.every(a => a.type === SearchResultType.album));
      assert.ok(searchResults.find(a => a.title === searchAlbumPhrase));
      assert.ok(searchResults.find(a => a.title === trackBaseData.albumName));
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
        .get('/search/' + searchArtistPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      assert.strictEqual(searchResults.length, 2);
      assert.ok(searchResults.every(a => a.type === SearchResultType.artist));
      assert.ok(searchResults.find(a => a.title === searchArtistPhrase));
      assert.ok(searchResults.find(a => a.title === trackBaseData.artistName));
    }).timeout(5000);

    it('should ignore case sensitivity', async () => {
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
        .get('/search/' + searchTrackPhrase.toUpperCase())
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      assert.strictEqual(searchResults.length, 2);
      assert.ok(searchResults.every(t => t.type === SearchResultType.track));
      assert.ok(searchResults.find(t => t.title === searchTrackPhrase));
      assert.ok(searchResults.find(t => t.title === trackBaseData.title));
    }).timeout(5000);
  });

  describe('GET /search/id/:id', () => {
    it('should return track by id', async () => {
      // ARRANGE
      const searchTrackPhrase = new ObjectID().toHexString();
      const trackBaseData = {
        title: searchTrackPhrase,
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const dbClient = await new DbConnector(new Config()).connect();
      const app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      const { searchResults } = await request(app)
        .get('/search/' + searchTrackPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      const uploadedTrack = searchResults[0];

      // ACT
      const { searchByIdResult } = await request(app)
        .get('/search/id/' + uploadedTrack._id)
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
      assert.ok(searchByIdResult.mimetype);
    }).timeout(5000);

    it('should return album by id', async () => {
      // ARRANGE
      const searchAlbumPhrase = new ObjectID().toHexString();
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: searchAlbumPhrase,
        artistName: new ObjectID().toHexString()
      };
      const dbClient = await new DbConnector(new Config()).connect();
      const app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      const { searchResults } = await request(app)
        .get('/search/' + searchAlbumPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      const uploadedAlbum = searchResults[0];

      // ACT
      const { searchByIdResult } = await request(app)
        .get('/search/id/' + uploadedAlbum._id)
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
      assert.ok(searchByIdResult.tracks[0].fileId);
      assert.ok(searchByIdResult.tracks[0].mimetype);
      assert.ok(searchByIdResult.tracks[0].number);
      assert.ok(searchByIdResult.artistId);
    }).timeout(5000);

    it('should return artist by id', async () => {
      // ARRANGE
      const searchArtistPhrase = new ObjectID().toHexString();
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: searchArtistPhrase
      };
      const dbClient = await new DbConnector(new Config()).connect();
      const app = createApp(dbClient, trackBaseData);

      await request(app)
        .post('/track')
        .set('Content-type', 'multipart/form-data')
        .attach('file1', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200);

      const { searchResults } = await request(app)
        .get('/search/' + searchArtistPhrase)
        .expect(200)
        .then(({ body }) => ({ searchResults: body }));

      const uploadedArtist = searchResults[0];

      // ACT
      const { searchByIdResult } = await request(app)
        .get('/search/id/' + uploadedArtist._id)
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
    });
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
  const searcher = new Searcher(dbClient, new Logger());

  return new SearchController(searcher);
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
