#!/bin/bash
# Installs cargo-audit to ~/.local/bin and verifies the download against a
# pinned checksum. Expects CARGO_AUDIT_VERSION and CARGO_AUDIT_CHECKSUM.
set -euo pipefail

VERSION="${CARGO_AUDIT_VERSION#v}"
CHECKSUM="${CARGO_AUDIT_CHECKSUM}"
NAME="cargo-audit-x86_64-unknown-linux-musl-v${VERSION}"

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

url="https://github.com/rustsec/rustsec/releases/download/cargo-audit%2Fv${VERSION}/${NAME}.tgz"
curl -sSfL --retry 5 --retry-all-errors --retry-delay 1 --retry-max-time 30 \
  "${url}" -o "${work_dir}/cargo-audit.tgz"
echo "${CHECKSUM}  ${work_dir}/cargo-audit.tgz" | sha256sum -c

tar -xzf "${work_dir}/cargo-audit.tgz" -C "${work_dir}" "${NAME}/cargo-audit"
mkdir -p ~/.local/bin/
mv "${work_dir}/${NAME}/cargo-audit" ~/.local/bin/cargo-audit
