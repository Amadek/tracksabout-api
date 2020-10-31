
class DbCreator {
  create () {
    const artists = [
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

    db.artists.deleteMany({});
    db.atrists.insertMany(artist);
  }
}