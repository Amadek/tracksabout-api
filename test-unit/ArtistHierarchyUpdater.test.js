/* global describe it */
const AritstHierarchyUpdater = require('../src/entities/ArtistHierarchyUpdater');
const assert = require('assert');
const { ObjectID } = require('mongodb');
const Logger = require('../src/controllers/Logger');

describe('ArtistHierarchyUpdater', () => {
  describe('update()', () => {
    it('should create artist when artist from track does not exist', async () => {
      // ARRANGE
      const uploadedTrack = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            countDocuments: () => Promise.resolve(0),
            insertOne: obj => Promise.resolve({ ops: [obj] }),
            findOne: () => Promise.resolve(),
            updateOne: (_filter, { $set }) => Promise.resolve($set)
          })
        })
      };
      const updater = new AritstHierarchyUpdater(dbClient, new Logger());
      // ACT
      const result = await updater.update(uploadedTrack);

      // ASSERT
      assert.ok(result.updated);
      assert.strictEqual(result.updatedArtist.name, uploadedTrack.artistName);
      assert.strictEqual(result.updatedArtist.albums.length, 1);
      assert.strictEqual(result.updatedArtist.albums[0].name, uploadedTrack.albumName);
      assert.strictEqual(result.updatedArtist.albums[0].tracks.length, 1);
      assert.strictEqual(result.updatedArtist.albums[0].tracks[0].title, uploadedTrack.title);
    });

    it('should create album when artist from track does not have specific album', done => {
      // ARRANGE
      const uploadedTrack = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            countDocuments: () => Promise.resolve(1),
            insertOne: () => Promise.resolve(),
            findOne: () => Promise.resolve({
              name: uploadedTrack.artistName,
              albums: [{ name: new ObjectID().toHexString(), tracks: [{ title: new ObjectID().toHexString() }] }]
            }),
            updateOne: (_filter, { $set }) => Promise.resolve($set)
          })
        })
      };
      const updater = new AritstHierarchyUpdater(dbClient, new Logger());
      // ACT
      updater.update(uploadedTrack)
        .then(result => {
          // ASSERT
          assert.ok(result.updated);
          assert.strictEqual(result.updatedArtist.name, uploadedTrack.artistName);
          assert.strictEqual(result.updatedArtist.albums.length, 2);
          assert.strictEqual(result.updatedArtist.albums[1].name, uploadedTrack.albumName);
          assert.strictEqual(result.updatedArtist.albums[1].tracks.length, 1);
          assert.strictEqual(result.updatedArtist.albums[1].tracks[0].title, uploadedTrack.title);
          done();
        })
        .catch(err => done(err));
    });

    it('should create track when album from track does not have specific track', done => {
      // ARRANGE
      const uploadedTrack = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            countDocuments: () => Promise.resolve(1),
            insertOne: () => Promise.resolve(),
            findOne: () => Promise.resolve({
              name: uploadedTrack.artistName,
              albums: [{ name: uploadedTrack.albumName, tracks: [{ title: new ObjectID().toHexString() }] }]
            }),
            updateOne: (_filter, { $set }) => Promise.resolve($set)
          })
        })
      };
      const updater = new AritstHierarchyUpdater(dbClient, new Logger());
      // ACT
      updater.update(uploadedTrack)
        .then(result => {
          // ASSERT
          assert.ok(result.updated);
          assert.strictEqual(result.updatedArtist.name, uploadedTrack.artistName);
          assert.strictEqual(result.updatedArtist.albums.length, 1);
          assert.strictEqual(result.updatedArtist.albums[0].name, uploadedTrack.albumName);
          assert.strictEqual(result.updatedArtist.albums[0].tracks.length, 2);
          assert.strictEqual(result.updatedArtist.albums[0].tracks[1].title, uploadedTrack.title);
          done();
        })
        .catch(err => done(err));
    });

    it('should not create track when album from track has specific track', done => {
      // ARRANGE
      const uploadedTrack = {
        title: new ObjectID().toHexString(),
        albumName: new ObjectID().toHexString(),
        artistName: new ObjectID().toHexString()
      };
      const dbClient = {
        db: () => ({
          collection: () => ({
            countDocuments: () => Promise.resolve(1),
            insertOne: () => Promise.resolve(),
            findOne: () => Promise.resolve({
              name: uploadedTrack.artistName,
              albums: [{ name: uploadedTrack.albumName, tracks: [{ title: uploadedTrack.title }] }]
            }),
            updateOne: (_filter, { $set }) => Promise.resolve($set)
          })
        })
      };
      const updater = new AritstHierarchyUpdater(dbClient, new Logger());
      // ACT
      updater.update(uploadedTrack)
        .then(result => {
          // ASSERT
          assert.strictEqual(result.updated, false);
          assert.ok(result.message);
          done();
        })
        .catch(err => done(err));
    });
  });
});
