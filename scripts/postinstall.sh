#!/bin/bash
# - Prevent postinstall from running outside of production environment.

if [ "$NODE_ENV" == "production" ]
then
	npm run build
fi
