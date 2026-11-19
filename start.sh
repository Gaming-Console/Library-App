#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "יש להתקין Node.js 20.19 ומעלה: https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm ci
exec node scripts/launch.mjs "$@"
