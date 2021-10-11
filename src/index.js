const DbConnector = require('./DbConnector');
const express = require('express');
const TrackController = require('./Controllers/TrackController');
const TrackParser = require('./TrackParser');
const TrackPresenceValidator = require('./TrackPresenceValidator');
const { NotFound } = require('http-errors');
const Logger = require('./Controllers/Logger');
const Config = require('./Config');
const BusboyStreamReaderToValidateTrack = require('./Controllers/BusboyStreamReaderToValidateTrack');
const BusboyStreamReaderToUploadTrack = require('./Controllers/BusboyStreamReaderToUploadTrack');
const Searcher = require('./Searcher/Searcher');
const SearchController = require('./Controllers/SearchController');
const https = require('https');
const fs = require('fs/promises');
const assert = require('assert');
const TrackStreamer = require('./TrackStreamer');
const FileLifetimeActionsFactory = require('./FileLifetimeActions/FileLifetimeActionsFactory');

class App {
  constructor (dbConnector, config, logger) {
    assert.ok(dbConnector); this._dbConnector = dbConnector;
    assert.ok(config); this._config = config;
    assert.ok(logger); this._logger = logger;
  }

  async run () {
    const dbClient = await this._dbConnector.connect();
    const expressApp = this._createExpressApp(dbClient);
    const certFiles = await this._readCertFiles(this._config.certKeyPath, this._config.certFilePath);

    https.createServer({
      key: certFiles.key,
      cert: certFiles.cert
    }, expressApp)
      .listen(config.appPort, () => this._logger.log(this, `Listening on HTTPS, port = ${config.appPort}...`));
  }

  _createExpressApp (dbClient) {
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
    app.use('/track', this._createTrackController(dbClient).route());
    app.use('/search', this._createSearchController(dbClient).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));

    const indexLogger = new Logger();
    app.use((err, _req, res, _next) => {
      indexLogger.log(this, err);
      res.status(err.status ?? 500).json({ message: err.message, additionalData: err.additionalData });
    });

    return app;
  }

  _createTrackController (dbClient) {
    const trackParser = new TrackParser(new Logger());
    const trackStreamer = new TrackStreamer(new Searcher(dbClient, new Logger()), dbClient, new Logger());
    const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
    const fileLifetimeActionsFactory = new FileLifetimeActionsFactory(dbClient);
    const busboyStreamReaderToValidateTrack = new BusboyStreamReaderToValidateTrack(trackParser, trackPresenceValidator, new Logger());
    const busboyStreamReaderToUploadTrack = new BusboyStreamReaderToUploadTrack(trackParser, fileLifetimeActionsFactory, new Logger());

    return new TrackController(busboyStreamReaderToUploadTrack, busboyStreamReaderToValidateTrack, trackStreamer, new Logger());
  }

  _createSearchController (dbClient) {
    const searcher = new Searcher(dbClient, new Logger());
    return new SearchController(searcher);
  }

  async _readCertFiles (certKeyPath, certFilePath) {
    const certFiles = {};
    const readKeyPromise = fs.readFile(certKeyPath).then(certKeyFile => { certFiles.key = certKeyFile; });
    const readCertPromise = fs.readFile(certFilePath).then(certFile => { certFiles.cert = certFile; });

    await Promise.all([readKeyPromise, readCertPromise]);
    return certFiles;
  }
}

const config = new Config();
const app = new App(new DbConnector(config), config, new Logger());
app.run();
