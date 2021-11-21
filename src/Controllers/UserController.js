const { Router } = require('express');
const assert = require('assert');
const UserManager = require('../Users/UserManager');
const { BadRequest } = require('http-errors');
const JwtManagerHS256 = require('./JwtManagerHS256');

module.exports = class UserController {
  constructor (jwtManager, userManager) {
    assert.ok(jwtManager instanceof JwtManagerHS256); this._jwtManager = jwtManager;
    assert.ok(userManager instanceof UserManager); this._userManager = userManager;
  }

  route () {
    const router = Router();
    router.get('/', this._getUser.bind(this));
    return router;
  }

  async _getUser (req, res, next) {
    try {
      const token = this._validateToken(req);
      const user = await this._userManager.getUser(token.gitHubUserId);
      res.json(user);
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
