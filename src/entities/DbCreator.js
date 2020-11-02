
module.exports = class DbCreator {
  static artists = [
    {
      name: 'Yes',
      albums: [
        { name: 'The Yes Album' },
        { name: 'Close To The Edge' }
      ]
    },
    {
      name: 'Queen',
      albums: [
        { name: 'The Miracle' }
      ]
    }
  ];

  constructor (db) {
    this._db = db;
  }

  create () {
    this._db.collection('artists').deleteMany({});
    this._db.collection('artists').insertMany(DbCreator.artists);

    return this._db;
  }
}