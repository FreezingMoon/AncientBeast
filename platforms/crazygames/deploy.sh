#!/usr/bin/env sh
set -e
vite build
vercel --prod --scope freezingmoon --project crazygames --cwd deploy/crazygames