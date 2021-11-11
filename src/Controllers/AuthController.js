const { Router } = require('express');
const { BadRequest } = require('http-errors');
const assert = require('assert');
const Logger = require('../Logging/Logger');
const Config = require('../Config');
const fetch = require('node-fetch');

module.exports = class AuthController {
  /**
   * @param {Config} config
   */
  constructor (config) {
    assert.ok(config instanceof Config); this._config = config;
    this._logger = new Logger();
  }

  route () {
    const router = Router();
    router.get('/', this._getAuth.bind(this));
    router.get('/redirect', this.getAuthRedirect.bind(this));
    return router;
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  _getAuth (req, res, next) {
    try {
      if (!req.query.client_id || !req.query.redirect_url) throw new BadRequest();

      const internalRedirectUrl = new URL(this._getBaseUrl(req) + '/redirect');
      internalRedirectUrl.searchParams.append('client_id', req.query.client_id.toString());
      internalRedirectUrl.searchParams.append('redirect_url', req.query.redirect_url.toString());

      const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
      authorizeUrl.searchParams.append('client_id', req.query.client_id.toString());
      authorizeUrl.searchParams.append('redirect_uri', 'https://' + internalRedirectUrl.toString());

      this._logger.log(this, 'Redirecting to: ' + authorizeUrl.toString());

      res.redirect(authorizeUrl.toString());
    } catch (error) {
      next(error);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async getAuthRedirect (req, res, next) {
    try {
      if (!req.query.client_id || !req.query.code || !req.query.redirect_url) throw new BadRequest();

      if (req.query.error) {
        throw new Error(JSON.stringify({
          error: req.query.error,
          error_description: req.query.error_description,
          error_uri: req.query.error_uri
        }));
      }

      const accessToken = await this._getAccessToken(req.query.client_id, req.query.code /* request token */);
      const gitHubUserId = await this._getGitHubUserId(accessToken);

      const redirectUrl = new URL(req.query.redirect_url.toString());
      redirectUrl.searchParams.append('gitHubUserId', gitHubUserId);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      next(error);
    }
  }

  /**
   * @param {import('express').Request} req
   * @returns {string} Url
   */
  _getBaseUrl (req) {
    return req.headers.host + req.baseUrl;
  }

  async _getAccessToken (clientId, requestToken) {
    const getAccessTokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: this._config.gitHubClientSecret,
        code: requestToken
      })
    });

    const getAccessTokenJson = await getAccessTokenResponse.json();

    if (!getAccessTokenResponse.ok) throw new Error(JSON.stringify(getAccessTokenJson));

    return getAccessTokenJson.access_token;
  }

  async _getGitHubUserId (accessToken) {
    const getGitHubUserResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'token ' + accessToken,
        accept: 'application/json'
      }
    });

    const getGitHubUserJson = await getGitHubUserResponse.json();

    if (!getGitHubUserResponse.ok) throw new Error(JSON.stringify(getGitHubUserJson));

    return getGitHubUserJson.id;
  }
};
