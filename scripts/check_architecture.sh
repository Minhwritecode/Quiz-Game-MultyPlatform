#!/usr/bin/env bash
set -euo pipefail

if rg -n "package:flutter/|package:drift|package:supabase|package:google_mlkit" lib/features/*/domain; then
  echo "Domain layer imports an outer/UI/infrastructure package."
  exit 1
fi

if rg -n "data/|datasources|SupabaseClient|DriftDatabase" lib/features/*/presentation; then
  echo "Presentation layer reaches into infrastructure."
  exit 1
fi

echo "Clean Architecture boundary check passed."

