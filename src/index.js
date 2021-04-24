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

const config = new Config();

Promise.resolve()
  .then(() => new DbConnector(config).connect())
  .then(dbClient => {
    const app = express();
    app.use(express.json());
    const logger = new Logger();
    const trackParser = new TrackParser(new Logger());
    const trackUploader = new TrackUploader(dbClient, new Logger());
    const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
    const artistHierarchyUpdater = new AritstHierarchyUpdater(dbClient, new Logger());
    app.use('/track', new TrackController(trackParser, trackUploader, trackPresenceValidator, artistHierarchyUpdater, new Logger()).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));
    app.use((err, _req, res, _next) => {
      logger.log('index', err);
      res.status(err.status).send(err.stack);
    });
    app.listen(3000, () => logger.log('index', `Listening on ${config.appPort}...`));
  });
