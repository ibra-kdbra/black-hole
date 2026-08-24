#!/usr/bin/env bash
# Configure GPG commit signing so commits made in this repository are
# verifiable on GitHub, including from Claude Code cloud sessions.
#
# Requires the environment variable GIT_SIGNING_KEY_B64: the base64 of an
# ASCII-armored private GPG key. In Claude Code on the web, set it under
# the environment's variables; locally, export it in your shell profile.
#
# Without that variable the script exits quietly and git behaves as usual.
set -euo pipefail

[ -n "${GIT_SIGNING_KEY_B64:-}" ] || exit 0
command -v gpg >/dev/null 2>&1 || exit 0

printf '%s' "$GIT_SIGNING_KEY_B64" | base64 -d 2>/dev/null | gpg --batch --quiet --import 2>/dev/null || exit 0

KEY_ID=$(gpg --list-secret-keys --keyid-format long 2>/dev/null | awk '/^sec/ {split($2, a, "/"); print a[2]; exit}')
[ -n "$KEY_ID" ] || exit 0

git config gpg.format openpgp
git config gpg.program gpg
git config user.signingkey "$KEY_ID"
git config commit.gpgsign true
git config tag.gpgsign true

echo "Commit signing configured with GPG key $KEY_ID"
