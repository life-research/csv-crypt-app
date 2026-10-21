#!/bin/sh
# Makes test vectors with the original csv-crypt CLI (needs Java).
# The jar comes from CSV_CRYPT_JAR, else from the GitHub release v0.5.
set -eu

cd "$(dirname "$0")/.."
FIXTURES=test/fixtures
# Test key from the CLI's own tests (key1). Never use it for real data.
KEY=$(cat "$FIXTURES/key.txt")

if [ -z "${CSV_CRYPT_JAR:-}" ]; then
  CACHE=.cache
  CSV_CRYPT_JAR="$CACHE/csv-crypt-0.5/csv-crypt-0.5-standalone.jar"
  if [ ! -f "$CSV_CRYPT_JAR" ]; then
    mkdir -p "$CACHE"
    curl -fsSL -o "$CACHE/csv-crypt.tar.gz" \
      https://github.com/life-research/csv-crypt/releases/download/v0.5/csv-crypt-0.5.tar.gz
    tar -xzf "$CACHE/csv-crypt.tar.gz" -C "$CACHE"
  fi
fi

cli() {
  java -jar "$CSV_CRYPT_JAR" "$@"
}

# name, extra encrypt options
make_vector() {
  name=$1
  shift
  input="$FIXTURES/input/$name"
  base="$FIXTURES/cli/${name%.*}"
  cli -e -k "$KEY" "$@" "$input" "$base.crypt.csv"
  cli -d -k "$KEY" "$base.crypt.csv" "$base.decrypt-utf8.csv"
  cli -d -k "$KEY" --out-optimize-win "$base.crypt.csv" "$base.decrypt-excel.csv"
}

mkdir -p "$FIXTURES/cli"
make_vector example-comma-utf8.csv
make_vector excel-2013-unicode-text.txt --in-tab-separated
make_vector excel-2013-csv-german.csv --in-encoding ISO-8859-15 --in-separator ';'
make_vector edge-cases.csv
echo "Fixtures written to $FIXTURES/cli"
