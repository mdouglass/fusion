#!/bin/bash

# eval $(op signin --account douglass_family)

OP=$(op item get "Futures Parent Portal" --fields "label=username,password" --format json)
export USER=$(echo $OP | jq -r '.[] | select(.id == "username") | .value')
export PASSWORD=$(echo $OP | jq -r '.[] | select(.id == "password") | .value')

OP=$(op item get "Backblaze" --fields "label=futures/keyID,futures/applicationKey" --format json)
export B2_KEY_ID=$(echo $OP | jq -r '.[] | select(.label == "futures/keyID") | .value')
export B2_APPLICATION_KEY=$(echo $OP | jq -r '.[] | select(.label == "futures/applicationKey") | .value')

npm start
