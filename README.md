# tracksabout-api
## Environment variables
1. __APP_PORT__=_port_ (optional, default 3000)
1. __DB_CONNECTION_STRING__=_mongodb+srv://..._
1. __CERT_KEY_PATH__=_amadek.key_ (optional for HTTPS in dev environment)
   __CERT_FILE_PATH__=_amadek.cert_ (optional for HTTPS in dev environment)
   For generating certificate, go to _Generating self-signed certificate with SAN_.
1. __JWT_SIGN_PASSWORD__=_random_secret_value_ for signing JWT tokens.

## Generating self-signed certificate with SAN
On server, inf folder _~/certs_ create file _localhost.cnf_ with content:
```
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
C = PL
O = T
emailAddress = your@email.com
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
```

And run following command:
```sh
openssl req -new -x509 -newkey rsa:2048 -sha256 -nodes \
-keyout localhost.key -days 3560 \
-out localhost.crt \
-config localhost.cnf
```

Now you can add your _/localhost.key_ path and _/localhost.crt_ to __CERT_KEY_PATH__ and __CERT_FILE_PATH__.

This certificate, when installed on local computer in Trusted Authorities, is verified and green in browser.