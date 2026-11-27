#!/usr/bin/env bash
# The connector supplies authenticated ref and blob identities. This script only reads the remote.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0
state=automation/daily-cycle-state.json
die() { echo "Publisher checkout: $*" >&2; exit 1; }
sha() { [[ $1 =~ ^[0-9a-f]{40}$ ]] || die "exact SHA required"; }
remote_ref() { git ls-remote --exit-code origin "refs/heads/$branch" | cut -f1; }
validate() { "${NODE_BINARY:-node}" scripts/validate-daily-cycle-preservation.mjs "$state" "$@"; }
command=$1; shift
directory=$1; repository=$2; branch=$3; base=$4; shift 4
case "$repository/$branch" in
  thomaschurchadams-eng/work-feel/main|thomaschurchadams-eng/cuai-recovery-disposable/private/nov27-checkout-proof) ;;
  *) die 'unrecognized repository or branch' ;;
esac
url="https://github.com/$repository.git"
sha "$base"
if [[ $command == open ]]; then
  [[ $# == 1 ]] || die 'authenticated state blob SHA required'
  sha "$1"
  mkdir -p "$directory"
  [[ -z $(ls -A "$directory") ]] || die 'checkout must start in an empty directory'
  cd "$directory"
  git init -q
  git remote add origin "$url"
  git remote set-url --push origin 'disabled://use-existing-publisher-write-plan'
  # Keep full ancestry; defer unrelated blob downloads until checkout needs them.
  git fetch -q --no-tags --filter=blob:none origin "refs/heads/$branch:refs/remotes/origin/publisher"
  [[ $(git rev-parse refs/remotes/origin/publisher) == "$base" ]] || die 'branch advanced before checkout'
  git checkout -q --detach "$base"
  [[ $(git hash-object "$state") == "$1" ]] || die 'authenticated state blob mismatch'
  [[ -z $(git status --porcelain) ]] || die 'dirty checkout'
  "${NODE_BINARY:-node}" --version
  git --version
  echo "Checkout verified $base $1"
  exit 0
fi
cd "$directory"
[[ $(git remote get-url origin) == "$url" ]] || die 'unexpected remote'
[[ $(git rev-parse HEAD) == "$base" ]] || die 'checkout base changed'
[[ -z $(git status --porcelain --untracked-files=all -- . ":(exclude)$state") ]] || die 'unexpected checkout changes'
case "$command" in
  prepare)
    [[ $# == 1 ]] || die 'immutable candidate file required'
    cp "$1" "$state"
    validate "$base"
    [[ $(remote_ref) == "$base" ]] || die 'stale proposal: refresh the write plan'
    echo "Validated proposal $base $(git hash-object "$state")"
    ;;
  verify)
    [[ $# == 3 ]] || die 'stored commit, authenticated head and immutable candidate file required'
    stored=$1; observed=$2; candidate=$3
    sha "$stored"; sha "$observed"
    git fetch -q --no-tags origin "refs/heads/$branch:refs/remotes/origin/publisher"
    [[ $(git rev-parse refs/remotes/origin/publisher) == "$observed" ]] || die 'ref changed: repeat readback'
    git merge-base --is-ancestor "$stored" "$observed" || die 'stored commit unreachable'
    [[ $(git show -s --format=%P "$stored") == "$base" ]] || die 'unexpected stored parent'
    [[ $(git diff --name-only "$base" "$stored") == "$state" ]] || die 'unexpected stored paths'
    git show "$stored:$state" | cmp - "$candidate" || die 'stored bytes differ from proposal'
    validate "$base" "$stored"
    echo "Stored commit verified $stored"
    ;;
  *) die 'expected open, prepare or verify' ;;
esac
