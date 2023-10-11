#!/bin/sh
## Requires openssl, nodejs, jq, pem-jwk, crypto
## mkdir keys
## cd keys
## npm install pem-jwk
## npm install jq
## npm install crypto
### create keypair - setting such options as desired. The names of the keyfile must be kept as private-key.pem and public-key.pem
## openssl genpkey -algorithm RSA -out private-key.pem -pkeyopt rsa_keygen_bits:2048
## extract public key
## openssl rsa -pubout -in private-key.pem -out public-key.pem
## FIXES for jwt.io compliance
# use base64Url encoding
# use echo -n in pack function

export OPENSSL_CONF=/dev/null

header='{
  "kid": "12345",
  "alg": "RS256"
}'

payload='{
  "iss": "https://example.com",
  "sub": "user-id-123",
  "aud": "client-app-id-123",
  "exp": 1735689600,
  "iat": 1563980400
}'

echo $payload

function pack() {
  # Remove line breaks and spaces
  echo $1 | sed -e "s/[\r\n]\+//g" | sed -e "s/ //g"
}

function base64url_encode {
  (if [ -z "$1" ]; then cat -; else echo -n "$1"; fi) |
    openssl base64 -e -A |
      sed s/\\+/-/g |
      sed s/\\//_/g |
      sed -E s/=+$//
}

# just for debugging
function base64url_decode {
  INPUT=$(if [ -z "$1" ]; then echo -n $(cat -); else echo -n "$1"; fi)
  MOD=$(($(echo -n "$INPUT" | wc -c) % 4))
  PADDING=$(if [ $MOD -eq 2 ]; then echo -n '=='; elif [ $MOD -eq 3 ]; then echo -n '=' ; fi)
  echo -n "$INPUT$PADDING" |
    sed s/-/+/g |
    sed s/_/\\//g |
    openssl base64 -d -A
}

if [ ! -f private-key.pem ]; then
  # Create private and public keys if they are not present already
  openssl genrsa 2048 > private-key.pem
  openssl rsa -in private-key.pem -pubout -out public-key.pem
fi

# Base64 Encoding
b64_header=$(pack "$header" | base64url_encode)
b64_payload=$(pack "$payload" | base64url_encode)
signature=$(echo -n $b64_header.$b64_payload | openssl dgst -sha256 -sign private-key.pem | base64url_encode)
# Export JWT
echo $b64_header.$b64_payload.$signature > jwt.txt
# Create JWK from public key
if [ ! -d ./node_modules/pem-jwk ]; then
  # A tool to convert PEM to JWK
  npm install pem-jwk
fi
jwk=$(./node_modules/.bin/pem-jwk public-key.pem)
# Add additional fields
jwk=$(echo '{"use":"sig"}' $jwk $header | jq -cs add)
# Export JWK
echo '{"keys":['$jwk']}'| jq . > jwks.json

echo "--- JWT ---"
cat jwt.txt
echo -e "\n--- JWK ---"
jq . jwks.json
