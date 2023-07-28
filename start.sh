#!/bin/bash

eval $(op signin --account douglass_family)

OP=$(op item get "Fusion Parent Portal" --fields "label=username,password" --format json)
export USER=$(echo $OP | jq -r '.[] | select(.id == "username") | .value')
export PASSWORD=$(echo $OP | jq -r '.[] | select(.id == "password") | .value')

OP=$(op item get "Backblaze" --fields "label=fusion/keyID,fusion/applicationKey" --format json)
export B2_KEY_ID=$(echo $OP | jq -r '.[] | select(.label == "fusion/keyID") | .value')
export B2_APPLICATION_KEY=$(echo $OP | jq -r '.[] | select(.label == "fusion/applicationKey") | .value')

npm start
