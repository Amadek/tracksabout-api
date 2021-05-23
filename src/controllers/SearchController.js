const assert = require('assert');
const { Router } = require('express');

module.exports = class SearchController {
  /**
   * @param {import('../entities/TrackFinder')} trackFinder
   */
  constructor (trackFinder) {
    assert.ok(trackFinder); this._trackFinder = trackFinder;
  }

  route () {
    const router = Router();
    // Regex for search words with spaces, with 3 or more characters
    router.post('/:phrase(\\w{3,}[\\w\\s]*)', this._postSearch.bind(this));
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
      const trackTitleRegexp = new RegExp(req.params.phrase);
      const tracks = await this._trackFinder.find(trackTitleRegexp);

      return res.json(tracks);
    } catch (error) {
      next(error);
    }
  }
};
