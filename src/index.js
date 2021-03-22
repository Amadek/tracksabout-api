const DbConnector = require('./entities/DbConnector.js');
const express = require('express');
const TrackController = require('./controllers/TrackController.js');
const TrackParser = require('./entities/TrackParser');
const TrackUploader = require('./entities/TrackUploader');
const { NotFound } = require('http-errors');
const AritstHierarchyUpdater = require('./entities/ArtistHierarchyUpdater');
const Logger = require('./controllers/Logger');

const dbConnector = new DbConnector();

Promise.resolve()
  .then(() => dbConnector.connect())
  .then(db => {
    const app = express();
    app.use(express.json());
    const logger = new Logger();
    const trackParser = new TrackParser(new Logger());
    const trackUploader = new TrackUploader(db, new Logger());
    const artistHierarchyUpdater = new AritstHierarchyUpdater(db, new Logger());
    app.use('/track', new TrackController(trackParser, trackUploader, artistHierarchyUpdater, new Logger()).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));
    app.use((err, _req, res, _next) => {
      logger.log('index', err);
      res.status(err.status).send(err.stack);
    });
    app.listen(3000, () => logger.log('index', `Listening on ${3000}...`));
  });
