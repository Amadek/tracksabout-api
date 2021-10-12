/* global describe it  */
const { TrackPresenceValidator } = require('../src/FileActions');
const { ObjectId } = require('mongodb');
const Logger = require('../src/Controllers/Logger');
const assert = require('assert');

describe(TrackPresenceValidator.name, () => {
  describe(TrackPresenceValidator.prototype.validate.name, () => {
    it('should return False when track has not artist yet in database', async () => {
      // ARRANGE
      const parsedTrack = {
        artistName: new ObjectId().toHexString(),
        albumName: new ObjectId().toHexString(),
        title: new ObjectId().toHexString()
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            findOne: () => Promise.resolve(null)
          })
        })
      };
      const validator = new TrackPresenceValidator(dbClient, new Logger());

      // ACT
      const validationResult = await validator.validate(parsedTrack);

      // ASSERT
      assert.strictEqual(validationResult, false);
    });

    it('should return False when track has artist but not album yet in database', async () => {
      // ARRANGE
      const parsedTrack = {
        artistName: new ObjectId().toHexString(),
        albumName: new ObjectId().toHexString(),
        title: new ObjectId().toHexString()
      };
      const existingArtist = {
        name: parsedTrack.artistName,
        albums: [{ name: new ObjectId().toHexString(), tracks: [] }]
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            findOne: () => Promise.resolve(existingArtist)
          })
        })
      };
      const validator = new TrackPresenceValidator(dbClient, new Logger());

      // ACT
      const validationResult = await validator.validate(parsedTrack);

      // ASSERT
      assert.strictEqual(validationResult, false);
    });

    it('should return False when track has artist with album but not with specific track yet in database', async () => {
      // ARRANGE
      const parsedTrack = {
        artistName: new ObjectId().toHexString(),
        albumName: new ObjectId().toHexString(),
        title: new ObjectId().toHexString()
      };
      const existingArtist = {
        name: parsedTrack.artistName,
        albums: [{ name: parsedTrack.albumName, tracks: [] }]
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            findOne: () => Promise.resolve(existingArtist)
          })
        })
      };
      const validator = new TrackPresenceValidator(dbClient, new Logger());

      // ACT
      const validationResult = await validator.validate(parsedTrack);

      // ASSERT
      assert.strictEqual(validationResult, false);
    });

    it('should return True when track has artist with album and with specific track already in database', async () => {
      // ARRANGE
      const parsedTrack = {
        artistName: new ObjectId().toHexString(),
        albumName: new ObjectId().toHexString(),
        title: new ObjectId().toHexString()
      };
      const existingArtist = {
        name: parsedTrack.artistName,
        albums: [{ name: parsedTrack.albumName, tracks: [{ title: parsedTrack.title }] }]
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            findOne: () => Promise.resolve(existingArtist)
          })
        })
      };
      const validator = new TrackPresenceValidator(dbClient, new Logger());

      // ACT
      const validationResult = await validator.validate(parsedTrack);

      // ASSERT
      assert.ok(validationResult);
    });
  });
});
