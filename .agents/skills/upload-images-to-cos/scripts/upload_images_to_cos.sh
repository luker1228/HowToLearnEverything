#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  upload_images_to_cos.sh [--env PATH] [--prefix PREFIX] file[:remote-name] ...

Examples:
  upload_images_to_cos.sh --env /path/to/.env --prefix articles /tmp/a.png
  upload_images_to_cos.sh /tmp/a.png:cover.png /tmp/b.png

Output:
  <local_path>\t<cos_key>\t<public_url>
USAGE
}

env_path="/data/home/lukemxjia/aritcles-hub/.env"
prefix="articles"

declare -a specs=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      env_path="$2"
      shift 2
      ;;
    --prefix)
      prefix="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      specs+=("$1")
      shift
      ;;
  esac
done

if [[ ${#specs[@]} -eq 0 ]]; then
  usage
  exit 1
fi

if ! command -v coscli >/dev/null 2>&1; then
  echo "coscli not found in PATH" >&2
  exit 1
fi

if [[ ! -f "$env_path" ]]; then
  echo "env file not found: $env_path" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  awk -F: -v k="$key" '$1 == k {sub(/^[[:space:]]+/, "", $2); print $2; exit}' "$env_path"
}

secret_id="$(read_env_value secretId)"
secret_key="$(read_env_value secretKye)"
if [[ -z "$secret_key" ]]; then
  secret_key="$(read_env_value secretKey)"
fi
bucket="$(read_env_value bucketName)"
region="$(read_env_value region)"

if [[ -z "$secret_id" || -z "$secret_key" || -z "$bucket" || -z "$region" ]]; then
  echo "missing COS credentials or bucket config in $env_path" >&2
  exit 1
fi

for spec in "${specs[@]}"; do
  local_path="${spec%%:*}"
  remote_name="${spec#*:}"
  if [[ "$remote_name" == "$spec" ]]; then
    remote_name="$(basename "$local_path")"
  fi

  if [[ ! -f "$local_path" ]]; then
    echo "local file not found: $local_path" >&2
    exit 1
  fi

  key="$remote_name"
  if [[ -n "$prefix" ]]; then
    key="${prefix%/}/$remote_name"
  fi

  coscli -i "$secret_id" -k "$secret_key" cp "$local_path" "cos://$bucket/$key" >/dev/null
  printf '%s\t%s\thttps://%s.cos.%s.myqcloud.com/%s\n' "$local_path" "$key" "$bucket" "$region" "$key"
done
