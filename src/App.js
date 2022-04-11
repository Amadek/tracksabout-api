const DbConnector = require('./DbConnector');
const express = require('express');
const { NotFound } = require('http-errors');
const Logger = require('./Logging/Logger');
const Config = require('./Config');
const Searcher = require('./SearchActions/Searcher');
const https = require('https');
const fs = require('fs/promises');
const assert = require('assert');
const { TrackParser, TrackPresenceValidator, TrackStreamer, ReversibleActionsFactory, TrackRemover } = require('./FileActions');
const { BusboyActionsFactory } = require('./RequestActions');
const TrackFieldsValidator = require('./FileActions/TrackFieldsValidator');
const LoggerFactory = require('./Logging/LoggerFactory');
const UserManager = require('./Users/UserManager');
const { TrackController, SearchController, AuthController, UserController, JwtManagerHS256 } = require('./Controllers');

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
      // We need to set '0.0.0.0' to access Express app with custom domain like api.example.com (etc/hosts magic) on other remote apps,
      // otherwise - is ONLY accessible via localhost alias.
      .listen(config.appPort, '0.0.0.0', () => this._logger.log(this, `Listening on HTTPS, port = ${config.appPort}...`));
  }

  _createExpressApp (dbClient) {
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
    app.use('/auth', this._createAuthController(dbClient, config).route());
    app.use('/track', this._createTrackController(dbClient, config).route());
    app.use('/search', this._createSearchController(dbClient, config).route());
    app.use('/user', this._createUserController(dbClient, config).route());
    // Any other route should throw Not Found.
    app.use((_req, _res, next) => next(new NotFound()));

    const indexLogger = new Logger();
    app.use((err, _req, res, _next) => {
      indexLogger.log(this, err);
      res.status(err.status ?? 500).json({ message: err.message, additionalData: err.additionalData });
    });

    return app;
  }

  _createAuthController (dbClient, config) {
    const loggerFactory = new LoggerFactory();
    const jwtManager = new JwtManagerHS256(config, loggerFactory);
    const userManager = new UserManager(dbClient, loggerFactory);

    return new AuthController(config, jwtManager, userManager, loggerFactory);
  }

  _createTrackController (dbClient, config) {
    const loggerFactory = new LoggerFactory();
    const jwtManager = new JwtManagerHS256(config, loggerFactory);
    const userManager = new UserManager(dbClient, loggerFactory);
    const trackParser = new TrackParser(new Logger());
    const trackRemover = new TrackRemover(dbClient, userManager, config, loggerFactory);
    const trackStreamer = new TrackStreamer(new Searcher(dbClient, new Logger()), dbClient, new Logger());
    const trackFieldsValidator = new TrackFieldsValidator(new Logger());
    const trackPresenceValidator = new TrackPresenceValidator(dbClient, new Logger());
    const reversibleActionsFactory = new ReversibleActionsFactory(dbClient);
    const busboyActionsFactory = new BusboyActionsFactory(trackParser, trackFieldsValidator, trackPresenceValidator, reversibleActionsFactory);
    const searcher = new Searcher(dbClient, new Logger());

    return new TrackController(busboyActionsFactory, trackStreamer, trackParser, trackRemover, searcher, jwtManager, new Logger());
  }

  _createSearchController (dbClient, config) {
    const loggerFactory = new LoggerFactory();
    const searcher = new Searcher(dbClient, new Logger());
    const jwtManager = new JwtManagerHS256(config, loggerFactory);

    return new SearchController(searcher, jwtManager);
  }

  _createUserController (dbClient, config) {
    const loggerFactory = new LoggerFactory();
    const jwtManager = new JwtManagerHS256(config, loggerFactory);
    const userManager = new UserManager(dbClient, loggerFactory);
    return new UserController(jwtManager, userManager);
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
