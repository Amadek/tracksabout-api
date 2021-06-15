require('dotenv').config();

module.exports = class Config {
  get dbConnectionString () { return process.env.DB_CONNECTION_STRING; }
  get appPort () { return process.env.APP_PORT; }
  get certKeyPath () { return process.env.CERT_KEY_PATH; }
  get certFilePath () { return process.env.CERT_FILE_PATH; }
};
