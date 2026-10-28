#!/bin/bash
# Installs the jar of the original csv-crypt CLI to CSV_CRYPT_JAR and verifies
# the download against a pinned checksum. Expects CSV_CRYPT_VERSION,
# CSV_CRYPT_CHECKSUM and CSV_CRYPT_JAR.
set -euo pipefail

VERSION="${CSV_CRYPT_VERSION#v}"
CHECKSUM="${CSV_CRYPT_CHECKSUM}"
NAME="csv-crypt-${VERSION}"

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

url="https://github.com/life-research/csv-crypt/releases/download/v${VERSION}/${NAME}.tar.gz"
curl -sSfL --retry 5 --retry-all-errors --retry-delay 1 --retry-max-time 30 \
  "${url}" -o "${work_dir}/csv-crypt.tar.gz"
echo "${CHECKSUM}  ${work_dir}/csv-crypt.tar.gz" | sha256sum -c

tar -xzf "${work_dir}/csv-crypt.tar.gz" -C "${work_dir}" "${NAME}/${NAME}-standalone.jar"
mkdir -p "$(dirname "${CSV_CRYPT_JAR}")"
mv "${work_dir}/${NAME}/${NAME}-standalone.jar" "${CSV_CRYPT_JAR}"
