const assert = require('assert');
const { Router } = require('express');
const { BadRequest } = require('http-errors');

module.exports = class SearchController {
  /**
   * @param {import('../entities/Finder')} finder
   */
  constructor (finder) {
    assert.ok(finder); this._finder = finder;
  }

  route () {
    const router = Router();
    router.post('/:phrase', this._postSearch.bind(this));
    return router;
  }

  /**
   * Searches artists albums and tracks.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async _postSearch (req, res, next) {
    assert.ok(req);
    assert.ok(res);
    assert.ok(next);

    try {
      if (!req.params.phrase || req.params.phrase.length < 3) throw new BadRequest('Search phrase is empty or too short!');

      const trackTitleRegexp = new RegExp(req.params.phrase);
      const tracks = await this._finder.find(trackTitleRegexp);

      return res.json(tracks);
    } catch (error) {
      next(error);
    }
  }
};
