const assert = require('assert');
const { Router } = require('express');
const { BadRequest, NotFound } = require('http-errors');
const { ObjectId } = require('mongodb');
const Searcher = require('../SearchActions/Searcher');
const JwtManagerHS256 = require('./JwtManagerHS256');

module.exports = class SearchController {
  /**
   * @param {Searcher} searcher
   * @param {JwtManagerHS256} jwtManager
   */
  constructor (searcher, jwtManager) {
    assert.ok(searcher instanceof Searcher); this._searcher = searcher;
    assert.ok(jwtManager instanceof JwtManagerHS256); this._jwtManager = jwtManager;
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
      this._validateToken(req);

      if (!req.params.phrase || req.params.phrase.length < 3) throw new BadRequest('Search phrase is empty or too short!');

      const trackTitleRegexp = new RegExp(req.params.phrase, 'i'); // 'i' = ignore case.
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
      if (!req.params.id || !ObjectId.isValid(req.params.id)) throw new BadRequest('Id is empty or invalid!');

      const searchResult = await this._searcher.searchById(new ObjectId(req.params.id));

      if (!searchResult) throw new NotFound(`Not found for id = ${req.params.id}`);

      return res.json(searchResult);
    } catch (error) {
      next(error);
    }
  }

  _validateToken (req) {
    if (!req.query.jwt) throw new BadRequest('JWT token not provided.');

    const token = this._jwtManager.parse(req.query.jwt);
    if (!token) throw new BadRequest('JWT token cannot be parsed and verified.');

    return token;
  }
};
