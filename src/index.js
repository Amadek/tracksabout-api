const DbConnector = require('./entities/DbConnector.js');
const DbCreator = require('./entities/DbCreator.js');

const dbConnector = new DbConnector();

return Promise.resolve()
  .then(() => dbConnector.connect())
  .then(db => new DbCreator(db).create())
  .then(db => db.collection('artists').find().toArray())
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .then(() => dbConnector.close());