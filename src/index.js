const DbConnector = require('./entities/DbConnector.js');
const express = require('express');
const TrackController = require('./controllers/TrackController.js');
const TrackParser = require('./entities/TrackParser');
const { NotFound } = require('http-errors');

const dbConnector = new DbConnector();

Promise.resolve()
  .then(() => dbConnector.connect())
  .then(db => {
    const app = express();
    app.use(express.json());
    app.use('/track', new TrackController(db, new TrackParser()).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));
    app.listen(3000, () => console.log(`Listening on ${3000}...`));
  });
