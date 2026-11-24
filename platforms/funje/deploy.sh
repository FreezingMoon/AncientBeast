#!/usr/bin/env sh
set -e
vite build
vercel --prod --scope freezingmoon --project funje --cwd deploy/funje
