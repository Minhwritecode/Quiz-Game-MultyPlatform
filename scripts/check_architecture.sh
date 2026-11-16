#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/check-architecture.cjs
node --test scripts/check-architecture.test.cjs
