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
    const trackParser = new TrackParser(new Logger());
    const trackUploader = new TrackUploader(db, new Logger());
    const artistHierarchyUpdater = new AritstHierarchyUpdater(db, new Logger());
    app.use('/track', new TrackController(trackParser, trackUploader, artistHierarchyUpdater, new Logger()).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));
    app.listen(3000, () => console.log(`Listening on ${3000}...`));
  });
