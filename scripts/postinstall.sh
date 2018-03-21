#!/bin/bash
# - Prevent postinstall from running outside of production environment.

if [ "$NODE_ENV" == "production" ]
then
	yarn run build
fi
