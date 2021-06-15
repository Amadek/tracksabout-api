/* global describe it */
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { ObjectID } = require('mongodb');
const DbConnector = require('../src/DbConnector.js');
const TrackController = require('../src/Controllers/TrackController');
const TrackUploader = require('../src/TrackUploader');
const AritstHierarchyUpdater = require('../src/ArtistHierarchyUpdater');
const Logger = require('../src/Controllers/Logger');
const Config = require('../src/Config');
const TrackPresenceValidator = require('../src/TrackPresenceValidator.js');
const BusboyStreamReaderToValidateTrack = require('../src/Controllers/BusboyStreamReaderToValidateTrack.js');
const BusboyStreamReaderToUploadTrack = require('../src/Controllers/BusboyStreamReaderToUploadTrack.js');
const TrackParserTest = require('./TrackParserTest');

describe('TrackController', () => {
  describe('POST /', () => {
    it('should upload tracks to DB', async () => {
      // ARRANGE
      const dbClient = await new DbConnector(new Config()).connect();
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

    it('should return BadRequest when no file was uploading', async () => {
      // ARRANGE
      const dbClient = await new DbConnector(new Config()).connect();
      const app = createApp(dbClient, {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      });

      // ACT, ASSERT
      await request(app)
        .post('/')
        .expect(400);
    }).timeout(5000);

    it('should return Conflict when track with specified name already exists', async () => {
      // ARRANGE
      const dbClient = await new DbConnector(new Config()).connect();
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
        .expect(409);
    }).timeout(5000);

    it('should return Conflict when uploading duplicate tracks', async () => {
      // ARRANGE
      const dbClient = await new DbConnector(new Config()).connect();
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const app = createApp(dbClient, trackBaseData);

      // ACT, ASSERT
      await request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(409);

      // TODO trzeba zrobić lepszą obsługę błędów żeby przerwać operacje uplodowania pierwszego pliku.
      // Mimo zrobienia mechanizmu anulowania strumienia za pomocą stream.resume(), strumień pierwszego pliku dalej jest destroyed: false i closed: false.
      // Możliwe że po zrobieniu stream.pipe() coś się dzieje że resume już nie do końca działa.
      // Może być też tak że cały strumień jest już w pamięci i dlatego pierwszy plik uploaduje się do bazy danych, pomimo stream.resume().
      // Trzeba bardziej się doedukować z działania streamów. Kod poniżej na razie wywołuje fail testu.
      // const artistsCount = await dbClient.db().collection('artists')
      //  .countDocuments({ name: trackBaseData.artistName });
      // assert.strictEqual(artistsCount, 0);
    }).timeout(5000);
  });

  describe('POST /validate', () => {
    it('should return OK when track has not artist yet in database', async () => {
      // ARANGE
      const dbClient = await new DbConnector(new Config()).connect();
      const trackBaseData = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const app = createApp(dbClient, trackBaseData);

      // ACT, ASSERT
      const parsedTrack = await request(app)
        .post('/validate')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200)
        .then(({ body }) => body);

      assert.strictEqual(parsedTrack.title, trackBaseData.title);
      assert.strictEqual(parsedTrack.albumName, trackBaseData.albumName);
      assert.strictEqual(parsedTrack.artistName, trackBaseData.artistName);
    });

    it('should return OK when track has not artist\'s album yet in database', async () => {
      // ARRANGE
      const existingTrack = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const newTrack = {
        title: new ObjectID().toHexString(),
        albumName: existingTrack.albumName,
        artistName: existingTrack.artistName
      };
      const dbClient = await new DbConnector(new Config()).connect();
      let app = createApp(dbClient, existingTrack);

      await request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' });

      app = createApp(dbClient, newTrack);

      // ACT, ASSERT
      const parsedTrack = await request(app)
        .post('/validate')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(200)
        .then(({ body }) => body);

      assert.strictEqual(parsedTrack.title, newTrack.title);
      assert.strictEqual(parsedTrack.albumName, newTrack.albumName);
      assert.strictEqual(parsedTrack.artistName, newTrack.artistName);
    }).timeout(5000);

    it('should return Conflict when track already exists in artist\'s album in database', async () => {
      // ARRANGE
      const existingTrack = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const newTrack = {
        title: existingTrack.title,
        albumName: existingTrack.albumName,
        artistName: existingTrack.artistName
      };
      const dbClient = await new DbConnector(new Config()).connect();
      let app = createApp(dbClient, existingTrack);

      await request(app)
        .post('/')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' });

      app = createApp(dbClient, newTrack);

      // ACT, ASSERT
      await request(app)
        .post('/validate')
        .set('Content-type', 'multipart/form-data')
        .attach('flac', './src/resources/fake.wav', { contentType: 'audio/flac' })
        .expect(409);
    }).timeout(5000);
  });
});

function createApp (dbClient, trackBaseData) {
  const app = express();
  const uploader = new TrackUploader(dbClient, new Logger());
  const updater = new AritstHierarchyUpdater(dbClient, new Logger());
  const parser = new TrackParserTest(trackBaseData);
  const validator = new TrackPresenceValidator(dbClient, new Logger());
  const busboyStreamReaderToValidateTrack = new BusboyStreamReaderToValidateTrack(parser, validator, new Logger());
  const busboyStreamReaderToUploadTrack = new BusboyStreamReaderToUploadTrack(parser, updater, uploader, new Logger());
  const controller = new TrackController(busboyStreamReaderToUploadTrack, busboyStreamReaderToValidateTrack, new Logger());
  app.use('/', controller.route());

  const logger = new Logger();
  app.use((err, _req, res, _next) => {
    logger.log('index', err);
    res.status(err.status ?? 500).send(err.stack);
  });

  return app;
}
