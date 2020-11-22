const DbConnector = require('./entities/DbConnector.js');
const DbCreator = require('./entities/DbCreator.js');
const express = require('express');
const expressFileUpload = require('express-fileupload');
const TrackController = require('./controllers/TrackController.js');
const { NotFound } = require('http-errors');

const dbConnector = new DbConnector();

Promise.resolve()
  .then(() => dbConnector.connect())
  .then(db => new DbCreator(db).create())
  .then(db => {
    const app = express();
    app.use(express.json());
    app.use(expressFileUpload());
    app.use('/track', new TrackController(db).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));
    app.listen(3000, () => console.log(`Listening on ${3000}...`));
  });
