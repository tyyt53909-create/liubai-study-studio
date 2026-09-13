#!/usr/bin/env bash
# One-shot private HTTPS deploy for a Linux host with Docker.
#   ./scripts/deploy.sh --domain study.example.com --email you@example.com
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN=""
EMAIL=""
ORIGIN=""
SKIP_BUILD=0
YES=0

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/deploy.sh --domain HOST --email ADDR [options]

Required (first deploy):
  --domain HOST     Public hostname (DNS must point here), e.g. study.example.com
  --email  ADDR     Contact email for Web Push VAPID (mailto)

Options:
  --origin URL      Override PUBLIC_ORIGIN (default https://HOST)
  --skip-build      compose up without --build
  -y, --yes         Do not ask to continue if .env already exists
  -h, --help        Show this help

What it does:
  1. Checks Docker / Compose
  2. If no .env: runs setup with domain+email (prints initial password once)
  3. If .env exists: reuses it (will not regenerate password)
  4. docker compose -f compose.production.yaml up -d --build --wait
  5. Prints URL and where the initial password lives

Security:
  .env and .login-secret stay on this host only (gitignored).
  Never paste them into GitHub issues or Actions logs.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --origin) ORIGIN="${2:-}"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    -y|--yes) YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$DOMAIN" && -z "$ORIGIN" && ! -f .env ]]; then
  echo "Error: --domain (or --origin) is required on first deploy." >&2
  usage >&2
  exit 2
fi
if [[ -z "$EMAIL" && ! -f .env ]]; then
  echo "Error: --email is required on first deploy." >&2
  usage >&2
  exit 2
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' not found. Install it on this host first." >&2
    exit 1
  }
}

need_cmd docker
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Error: Docker Compose not found (docker compose or docker-compose)." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon is not running or not accessible." >&2
  exit 1
fi

need_cmd node
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Error: Node.js 20+ required for setup (found $(node -v))." >&2
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "Error: run this from the repo root (package.json missing)." >&2
  exit 1
fi

if [[ ! -f node_modules/web-push/package.json ]]; then
  echo "→ npm ci (needed once to generate VAPID keys)"
  npm ci
fi

CREATED_ENV=0
if [[ -f .env ]]; then
  echo "→ Reusing existing .env (password will not be regenerated)."
  if [[ "$YES" -ne 1 ]]; then
    echo "   To force new secrets you must remove .env and .login-secret deliberately."
  fi
  # Optionally refresh PUBLIC_ORIGIN if user passed domain and file still has localhost
  if [[ -n "$DOMAIN" || -n "$ORIGIN" ]]; then
    TARGET_ORIGIN="$ORIGIN"
    if [[ -z "$TARGET_ORIGIN" && -n "$DOMAIN" ]]; then
      HOST_ONLY="$(echo "$DOMAIN" | sed -E 's#^https?://##; s#/.*##')"
      TARGET_ORIGIN="https://${HOST_ONLY}"
    fi
    if [[ -n "$TARGET_ORIGIN" ]] && grep -q '^PUBLIC_ORIGIN=http://localhost' .env 2>/dev/null; then
      echo "→ Updating PUBLIC_ORIGIN to ${TARGET_ORIGIN}"
      # portable in-place replace
      tmp="$(mktemp)"
      sed "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=${TARGET_ORIGIN}|" .env >"$tmp"
      chmod 600 "$tmp"
      mv "$tmp" .env
    fi
  fi
else
  echo "→ Generating secrets (first run)"
  SETUP_ARGS=()
  if [[ -n "$ORIGIN" ]]; then
    SETUP_ARGS+=(--origin "$ORIGIN")
  elif [[ -n "$DOMAIN" ]]; then
    SETUP_ARGS+=(--domain "$DOMAIN")
  fi
  if [[ -n "$EMAIL" ]]; then
    SETUP_ARGS+=(--email "$EMAIL")
  fi
  node scripts/setup.mjs "${SETUP_ARGS[@]}"
  CREATED_ENV=1
fi

# shellcheck disable=SC1091
set -a
# Export vars for compose without printing secrets
# parse KEY=VALUE lines
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  export "$key=$val"
done < .env
set +a

if [[ "${PUBLIC_ORIGIN:-}" != https://* ]]; then
  echo "Error: production deploy requires PUBLIC_ORIGIN to be https://..." >&2
  echo "  current: ${PUBLIC_ORIGIN:-<empty>}" >&2
  echo "  pass --domain your.domain or fix .env" >&2
  exit 1
fi

if [[ -z "${STUDY_PASSWORD_HASH:-}" || -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "Error: .env missing STUDY_PASSWORD_HASH or POSTGRES_PASSWORD." >&2
  exit 1
fi

echo "→ Starting stack (Caddy :80/:443, web internal, postgres internal)"
UP_FLAGS=( -f compose.production.yaml up -d --wait )
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  UP_FLAGS=( -f compose.production.yaml up -d --build --wait )
fi
"${COMPOSE[@]}" "${UP_FLAGS[@]}"

echo ""
echo "════════════════════════════════════════"
echo "  Deploy ready"
echo "  URL: ${PUBLIC_ORIGIN}"
if [[ -f .login-secret ]]; then
  if [[ "$CREATED_ENV" -eq 1 ]]; then
    echo "  Initial login password (also in .login-secret):"
    echo "    $(tr -d '\n' < .login-secret)"
  else
    echo "  Initial password file (if never removed): .login-secret"
    echo "  Show once:  npm run setup -- --print-password"
  fi
  echo "  After login: Settings → change password, then you may delete .login-secret"
else
  echo "  .login-secret not found — use the password you already saved, or reset hash on the host."
fi
echo "  Do not commit .env / .login-secret; do not paste them into GitHub."
echo "════════════════════════════════════════"
