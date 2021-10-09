
module.exports = class TestConfig {
  get testRunTimeout () { return 5 * 1000; }

  get uploadFlacFileTestTimeout () { return 60 * 1000; }

  get flacFilePath () { return './resources/Debussy - Pour les sixtes.flac'; }

  get flacFileMetadata () {
    return {
      title: 'Pour les sixtes',
      albumName: 'Etudes',
      artistName: 'Debussy',
      year: 1915,
      genre: 'Classical'
    };
  }

  get fakeFlacFilePath () { return './resources/Fake.flac'; }
};
