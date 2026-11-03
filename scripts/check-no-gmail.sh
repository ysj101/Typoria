#!/bin/sh
set -eu

range=${1:-origin/main..HEAD}
commits=$(git rev-list "$range" --)
failed=0

check_field() {
  if printf '%s\n' "$2" | grep -iFq '@gmail.com'; then
    printf 'gmail guard: %s contains the blocked domain\n' "$1" >&2
    failed=1
  fi
}

for sha in $commits; do
  metadata=$(git log -1 --format='%ae%n%ce%n%B' "$sha" --)
  author=$(printf '%s\n' "$metadata" | sed -n '1p')
  committer=$(printf '%s\n' "$metadata" | sed -n '2p')
  message=$(printf '%s\n' "$metadata" | sed '1,2d')
  check_field "commit $sha author email" "$author"
  check_field "commit $sha committer email" "$committer"
  check_field "commit $sha message" "$message"
done

check_field 'PR title' "${PR_TITLE-}"
check_field 'PR body' "${PR_BODY-}"

if [ "$failed" -ne 0 ]; then
  exit 1
fi
printf 'gmail guard: no matches\n'
