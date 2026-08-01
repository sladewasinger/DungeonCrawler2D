#!/usr/bin/env bash

set -euo pipefail

token_file=''
request_file=''
token_value=''

cleanup() {
  if [[ -n "$token_file" ]]; then
    rm -f -- "$token_file" || true
  fi
  if [[ -n "$request_file" ]]; then
    rm -f -- "$request_file" || true
  fi
  unset token_value || true
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$1" >&2
    exit 127
  fi
}

trap cleanup EXIT

if (( $# > 1 )); then
  printf 'Usage: %s [prompt]\n' "${0##*/}" >&2
  exit 2
fi

require_command aws
require_command jq

prompt=${1:-'Production admin token: '}
umask 077
token_file=$(mktemp)
request_file=$(mktemp)
chmod 600 "$token_file" "$request_file"

read -r -s -p "$prompt" token_value
printf '\n'
if [[ -z "$token_value" ]]; then
  printf 'Production admin token must not be empty.\n' >&2
  exit 1
fi

printf '%s' "$token_value" >"$token_file"
jq -n --rawfile value "$token_file" '{Value: $value}' >"$request_file"
aws ssm put-parameter \
  --cli-input-json "file://$request_file" \
  --name /dungeoncrawler2d/prod/admin-token \
  --type SecureString \
  --overwrite \
  --profile poweraccess-terraform \
  --region us-east-1 \
  --no-cli-pager
