#!/bin/bash
# Installs actionlint to ~/.local/bin and verifies the download against a
# pinned checksum. Expects ACTIONLINT_VERSION and ACTIONLINT_CHECKSUM.
set -euo pipefail

VERSION="${ACTIONLINT_VERSION#v}"
CHECKSUM="${ACTIONLINT_CHECKSUM}"

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

url="https://github.com/rhysd/actionlint/releases/download/v${VERSION}/actionlint_${VERSION}_linux_amd64.tar.gz"
curl -sSfL --retry 5 --retry-all-errors --retry-delay 1 --retry-max-time 30 \
  "${url}" -o "${work_dir}/actionlint.tar.gz"
echo "${CHECKSUM}  ${work_dir}/actionlint.tar.gz" | sha256sum -c

tar -xzf "${work_dir}/actionlint.tar.gz" -C "${work_dir}" actionlint
mkdir -p ~/.local/bin/
mv "${work_dir}/actionlint" ~/.local/bin/actionlint
