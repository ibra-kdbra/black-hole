# Commit signing

Commits in this repository are signed with GPG so GitHub marks them
**Verified**. This works locally and from Claude Code cloud sessions.

## The key

| Field | Value |
| --- | --- |
| Key ID | `5967E49BC0649448` |
| Type | Ed25519, no expiry, no passphrase |
| Identity | `ibra-kdbra <135609275+ibra-kdbra@users.noreply.github.com>` |

It is a dedicated signing key: it cannot encrypt, and it is used for
nothing but commit signatures.

## One-time setup

### 1. Register the public key on GitHub

Paste the public key at <https://github.com/settings/gpg/new>. GitHub
verifies retroactively, so every commit already signed with it becomes
Verified as soon as the key is registered.

### 2. Make cloud sessions sign automatically

Add an environment variable to the Claude Code environment:

- Name: `GIT_SIGNING_KEY_B64`
- Value: the base64 of the ASCII-armored private key, on a single line

Produce that value from the private key file with:

```bash
base64 -w0 signing-key-private.asc
```

`.claude/settings.json` registers a `SessionStart` hook that runs
`.claude/setup-signing.sh`, which imports the key from that variable and
points git at it. With no variable set the script exits quietly and git
behaves normally, so the repository still works for anyone else.

### 3. Sign from your own machine

```bash
gpg --import signing-key-private.asc
git config --global user.signingkey 5967E49BC0649448
git config --global commit.gpgsign true
git config --global gpg.format openpgp
```

## Verifying

```bash
git log --format='%G? %GK %s' -5
```

`G` means a good signature, `N` means unsigned.

## Notes

- The private key is stored in a cloud environment variable. That is an
  accepted trade-off for a dedicated signing key with no other authority;
  never store an identity or encryption key this way.
- To revoke: delete the key at <https://github.com/settings/keys>, remove
  the environment variable, and re-sign history with a replacement key.
