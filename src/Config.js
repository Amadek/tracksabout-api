require('dotenv').config();

module.exports = class Config {
  get dbConnectionString () { return process.env.DB_CONNECTION_STRING; }
  get appPort () { return process.env.APP_PORT; }
};
