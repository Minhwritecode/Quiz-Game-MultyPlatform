#!/usr/bin/env bash
set -euo pipefail

if rg -n "from ['\"](react-native|expo|@supabase|@/core/(network|database))|require\(['\"](react-native|expo|@supabase)" src/core/domain src/features/*/domain 2>/dev/null; then
  echo "Domain or feature contracts import an outer/UI/infrastructure package."
  exit 1
fi

if rg -n "from ['\"](@supabase|expo-sqlite|@/core/(network|database))|require\(['\"](@supabase|expo-sqlite)" src/app src/shared 2>/dev/null; then
  echo "Presentation layer reaches into infrastructure directly."
  exit 1
fi

echo "Clean Architecture boundary check passed."
