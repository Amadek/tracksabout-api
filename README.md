# tracksabout-api
## Environment variables
1. __APP_PORT__=_port_ (optional, default 3000)
1. __DB_CONNECTION_STRING__=_mongodb+srv://..._
1. __CERT_KEY_PATH__=_amadek.key_ (optional for HTTPS in dev environment)
   __CERT_FILE_PATH__=_amadek.cert_ (optional for HTTPS in dev environment)
   For generating certificate, go to _Generating self-signed certificate with SAN_.
1. __JWT_SIGN_PASSWORD__=_random_secret_value_ for signing JWT tokens.