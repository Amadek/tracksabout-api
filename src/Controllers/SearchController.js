const assert = require('assert');
const { Router } = require('express');
const { BadRequest, NotFound } = require('http-errors');
const { ObjectID } = require('mongodb');

module.exports = class SearchController {
  /**
   * @param {import('../Searcher/Searcher')} searcher
   */
  constructor (searcher) {
    assert.ok(searcher); this._searcher = searcher;
  }

  route () {
    const router = Router();
    router.get('/:phrase', this._getSearch.bind(this));
    router.get('/id/:id', this._getSearchById.bind(this));
    return router;
  }

  /**
   * Searches artists, albums and tracks.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async _getSearch (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      if (!req.params.phrase || req.params.phrase.length < 3) throw new BadRequest('Search phrase is empty or too short!');

      const trackTitleRegexp = new RegExp(req.params.phrase);
      const tracks = await this._searcher.search(trackTitleRegexp);

      return res.json(tracks);
    } catch (error) {
      next(error);
    }
  }

  async _getSearchById (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      if (!req.params.id || !ObjectID.isValid(req.params.id)) throw new BadRequest('Id is empty or too short!');

      const searchResult = await this._searcher.searchById(new ObjectID(req.params.id));

      if (!searchResult) throw new NotFound(`Not found for id = ${req.params.id}`);

      return res.json(searchResult);
    } catch (error) {
      next(error);
    }
  }
};
