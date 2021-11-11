/* global describe it */
const Logger = require('../src/Logging/Logger');
const TrackFieldsValidator = require('../src/FileActions/TrackFieldsValidator');
const assert = require('assert');

describe(TrackFieldsValidator.name, () => {
  it('should valid basic track fields', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result);
    assert.ok(!validationResult.message);
  });

  it('should return falsy result when track without number field', () => {
    // ARRANGE
    const track = {
      /* number: 1, */
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track with wrong number field', () => {
    // ARRANGE
    const track = {
      number: 'WRONG',
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track without title field', () => {
    // ARRANGE
    const track = {
      number: 1,
      /* title: 'title', */
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track without duration field', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      /* duration: '30', */
      albumName: 'albumName',
      artistName: 'artistName',
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track without album name field', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      duration: '30',
      /* albumName: 'albumName', */
      artistName: 'artistName',
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track without artist name field', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      /* artistName: 'artistName', */
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track without year field', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      /* year: 2000, */
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track with wrong year field', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      year: 'WRONG',
      mimetype: 'mimetype'
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track without mimetype field', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      year: 2000
      /* mimetype: 'mimetype' */
    };
    const albumCover = {};
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });

  it('should return falsy result when track without cover', () => {
    // ARRANGE
    const track = {
      number: 1,
      title: 'title',
      duration: '30',
      albumName: 'albumName',
      artistName: 'artistName',
      year: 2000,
      mimetype: 'mimetype'
    };
    const albumCover = null;
    const validator = new TrackFieldsValidator(new Logger());

    // ACT
    const validationResult = validator.validate(track, albumCover);

    // ARRANGE
    assert.ok(validationResult.result === false);
    assert.ok(validationResult.message);
  });
});
