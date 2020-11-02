const { MongoClient } = require('mongodb');

module.exports = class DbConnector {
  constructor () {
    const uri = 'mongodb+srv://Amadek:Amadek@tracksabout.zicyv.mongodb.net/TracksAbout?retryWrites=true&w=majority';
    this._mongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  }

  connect () {
    return Promise.resolve()
      .then(() => this._mongoClient.connect())
      .then(client => client.db());
  }

  close () {
    this._mongoClient.close();
  }
}