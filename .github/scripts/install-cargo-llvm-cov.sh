#!/bin/bash
# Installs cargo-llvm-cov to ~/.local/bin and verifies the download against a
# pinned checksum. Expects CARGO_LLVM_COV_VERSION and CARGO_LLVM_COV_CHECKSUM.
set -euo pipefail

VERSION="${CARGO_LLVM_COV_VERSION#v}"
CHECKSUM="${CARGO_LLVM_COV_CHECKSUM}"

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

url="https://github.com/taiki-e/cargo-llvm-cov/releases/download/v${VERSION}/cargo-llvm-cov-x86_64-unknown-linux-musl.tar.gz"
curl -sSfL --retry 5 --retry-all-errors --retry-delay 1 --retry-max-time 30 \
  "${url}" -o "${work_dir}/cargo-llvm-cov.tar.gz"
echo "${CHECKSUM}  ${work_dir}/cargo-llvm-cov.tar.gz" | sha256sum -c

tar -xzf "${work_dir}/cargo-llvm-cov.tar.gz" -C "${work_dir}" cargo-llvm-cov
mkdir -p ~/.local/bin/
mv "${work_dir}/cargo-llvm-cov" ~/.local/bin/cargo-llvm-cov
