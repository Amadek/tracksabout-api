const DbConnector = require('./entities/DbConnector');
const express = require('express');
const TrackController = require('./controllers/TrackController');
const TrackParser = require('./entities/TrackParser');
const TrackPresenceValidator = require('./entities/TrackPresenceValidator');
const TrackUploader = require('./entities/TrackUploader');
const { NotFound } = require('http-errors');
const AritstHierarchyUpdater = require('./entities/ArtistHierarchyUpdater');
const Logger = require('./controllers/Logger');
const Config = require('./Config');
const BusboyStreamReaderToValidateTrack = require('./controllers/BusboyStreamReaderToValidateTrack');
const BusboyStreamReaderToUploadTrack = require('./controllers/BusboyStreamReaderToUploadTrack');
const Finder = require('./entities/Finder');
const SearchController = require('./controllers/SearchController');

const config = new Config();

Promise.resolve()
  .then(() => new DbConnector(config).connect())
  .then(dbClient => {
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
    app.use('/track', createTrackController(dbClient).route());
    app.use('/search', createSearchController(dbClient).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));

    const indexLogger = new Logger();
    app.use((err, _req, res, _next) => {
      indexLogger.log('index', err);
      res.status(err.status ?? 500).json({ message: err.message, additionalData: err.additionalData });
    });
    app.listen(config.appPort, () => indexLogger.log('index', `Listening on ${config.appPort}...`));
  });

function createTrackController (dbClient) {
  const trackParser = new TrackParser(new Logger());
  const trackUploader = new TrackUploader(dbClient, new Logger());
  const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
  const artistHierarchyUpdater = new AritstHierarchyUpdater(dbClient, new Logger());
  const busboyStreamReaderToValidateTrack = new BusboyStreamReaderToValidateTrack(trackParser, trackPresenceValidator, new Logger());
  const busboyStreamReaderToUploadTrack = new BusboyStreamReaderToUploadTrack(trackParser, artistHierarchyUpdater, trackUploader, new Logger());

  return new TrackController(busboyStreamReaderToUploadTrack, busboyStreamReaderToValidateTrack, new Logger());
}

function createSearchController (dbClient) {
  const finder = new Finder(dbClient, new Logger());
  return new SearchController(finder);
}
