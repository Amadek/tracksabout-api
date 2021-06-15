const DbConnector = require('./DbConnector');
const express = require('express');
const TrackController = require('./Controllers/TrackController');
const TrackParser = require('./TrackParser');
const TrackPresenceValidator = require('./TrackPresenceValidator');
const TrackUploader = require('./TrackUploader');
const { NotFound } = require('http-errors');
const AritstHierarchyUpdater = require('./ArtistHierarchyUpdater');
const Logger = require('./Controllers/Logger');
const Config = require('./Config');
const BusboyStreamReaderToValidateTrack = require('./Controllers/BusboyStreamReaderToValidateTrack');
const BusboyStreamReaderToUploadTrack = require('./Controllers/BusboyStreamReaderToUploadTrack');
const Searcher = require('./Searcher/Searcher');
const SearchController = require('./Controllers/SearchController');

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
  const searcher = new Searcher(dbClient, new Logger());
  return new SearchController(searcher);
}
