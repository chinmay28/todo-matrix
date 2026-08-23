#!/usr/bin/env bash
#
# To Do Matrix — Linux quick-start installer (Ubuntu / Debian / Raspberry Pi OS).
#
# One command, run as root, installs To Do Matrix as a hardened systemd service:
#
#   curl -fsSL https://raw.githubusercontent.com/chinmay28/todo-matrix/main/scripts/quickstart.sh | sudo bash
#
# The app is a static PWA — tasks live in each browser's localStorage, and the
# server's only job is to hand out the built bundle. So unlike CountRoster's
# installer there is no database, no backups, and nothing on the server that an
# upgrade could lose: the deployable artifact is a directory of files, served
# by scripts/serve.mjs (dependency-free node:http) under systemd.
#
# It is deliberately *non-disruptive* — re-run it any time to upgrade in place:
#
#   * Idempotent. Re-running only swaps in newer code.
#   * The new bundle is built while the old one keeps serving; if the build
#     fails, the running service is left untouched.
#   * The live web root is swapped only after a successful build, and the
#     previous one is kept — if the new version fails its health check, the
#     script ROLLS BACK to the previous web root and restarts.
#
# Node is needed at BUILD time (Vite) and at RUN time (serve.mjs), but the
# serving path uses only node:http from the standard library — no npm packages
# are installed on it.
#
# Configure via environment variables (all optional):
#
#   TODOMATRIX_REPO    git URL to clone     (default: https://github.com/chinmay28/todo-matrix.git)
#   TODOMATRIX_REF     branch/tag/commit    (default: main)
#   TODOMATRIX_USER    service system user  (default: todomatrix)
#   TODOMATRIX_PREFIX  install prefix       (default: /opt/todo-matrix; source → $PREFIX/src, web root → $PREFIX/www)
#   PORT               port to listen on    (default: 8688)
#   HOST               bind address         (default: 0.0.0.0)
#   INSTALL_NODE       auto | never         install Node 22 if missing/old (default: auto)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''; C_OFF=''
fi
log()  { printf '%s==>%s %s\n' "$C_BLUE" "$C_OFF" "$*"; }
ok()   { printf '%s ok %s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%swarn%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
die()  { printf '%serr %s %s\n' "$C_RED" "$C_OFF" "$*" >&2; exit 1; }
step() { printf '\n%s%s%s\n' "$C_DIM" "$*" "$C_OFF"; }

# ---------------------------------------------------------------------------
# Must be root (system-wide service + dedicated user)
# ---------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  die "Run as root: curl -fsSL .../quickstart.sh | sudo bash   (or: sudo ./scripts/quickstart.sh)"
fi
command -v systemctl >/dev/null 2>&1 || die "systemd is required (no systemctl found)."

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TODOMATRIX_REPO="${TODOMATRIX_REPO:-https://github.com/chinmay28/todo-matrix.git}"
TODOMATRIX_REF="${TODOMATRIX_REF:-main}"
SVC_USER="${TODOMATRIX_USER:-todomatrix}"
PREFIX="${TODOMATRIX_PREFIX:-/opt/todo-matrix}"
PORT="${PORT:-8688}"
HOST="${HOST:-0.0.0.0}"
INSTALL_NODE="${INSTALL_NODE:-auto}"

SRC_DIR="$PREFIX/src"
WEB_ROOT="$PREFIX/www"
SERVICE_NAME="todo-matrix"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

# If this script is being run from inside an existing checkout (sudo ./scripts/
# quickstart.sh) rather than piped from curl, build that checkout in place.
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd)"
LOCAL_CHECKOUT=""
if git -C "$SELF_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
  top="$(git -C "$SELF_DIR" rev-parse --show-toplevel)"
  if [ -f "$top/package.json" ] && grep -q '"name": *"todo-matrix"' "$top/package.json" 2>/dev/null; then
    LOCAL_CHECKOUT="$top"
    SRC_DIR="$top"   # build & serve from where the user already cloned
  fi
fi

log "To Do Matrix quick start"
printf '  %-10s %s\n' "source"  "$SRC_DIR"
printf '  %-10s %s\n' "webroot" "$WEB_ROOT"
printf '  %-10s %s\n' "service" "${SERVICE_NAME}.service (user: $SVC_USER)"
printf '  %-10s %s\n' "listen"  "http://$HOST:$PORT"

# Run npm/git as the service user so the tree stays owned by them. Falls back
# to plain exec before the user exists.
as_svc() {
  if id -u "$SVC_USER" >/dev/null 2>&1; then
    # Build needs devDependencies → make sure NODE_ENV isn't 'production'.
    sudo -u "$SVC_USER" --preserve-env=PATH env -u NODE_ENV "$@"
  else
    env -u NODE_ENV "$@"
  fi
}

# ---------------------------------------------------------------------------
# 1. Prerequisites: git, curl, Node >= 20 (build + serve)
# ---------------------------------------------------------------------------
step "[1/6] Prerequisites"

APT=0; command -v apt-get >/dev/null 2>&1 && APT=1
ensure_pkg() {
  command -v "$1" >/dev/null 2>&1 && return 0
  [ "$APT" -eq 1 ] || die "'$1' missing and no apt-get to install it. Install it and re-run."
  log "installing $1…"; apt-get update -y >/dev/null; apt-get install -y "$1" >/dev/null
}
ensure_pkg curl
ensure_pkg git
ok "git $(git --version | awk '{print $3}'), curl present"

node_ok=0
if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "${major:-0}" -ge 20 ] && node_ok=1
fi
if [ "$node_ok" -eq 1 ]; then
  ok "node $(node --version)"
else
  command -v node >/dev/null 2>&1 \
    && warn "node $(node --version) is too old; To Do Matrix needs Node >= 20." \
    || warn "Node.js not found (needed to build with Vite and to run the static server)."
  [ "$INSTALL_NODE" = never ] && die "Install Node >= 20 (https://github.com/nodesource/distributions) and re-run, or set INSTALL_NODE=auto."
  [ "$APT" -eq 1 ] || die "Automatic Node install needs apt. Install Node >= 20 manually and re-run."
  log "installing Node 22 via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs >/dev/null
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "${major:-0}" -ge 20 ] || die "Node install did not yield >= 20 (got $(node --version))."
  ok "node $(node --version) installed"
fi
NODE_BIN="$(command -v node)"

# ---------------------------------------------------------------------------
# 2. Dedicated system user (home = prefix, no login shell)
# ---------------------------------------------------------------------------
step "[2/6] Service user '$SVC_USER'"
if id -u "$SVC_USER" >/dev/null 2>&1; then
  ok "user '$SVC_USER' already exists"
else
  nologin="$(command -v nologin || echo /usr/sbin/nologin)"
  useradd --system --home-dir "$PREFIX" --create-home --shell "$nologin" "$SVC_USER"
  ok "created system user '$SVC_USER'"
fi

# ---------------------------------------------------------------------------
# 3. Source: clone or update
# ---------------------------------------------------------------------------
step "[3/6] Source at $SRC_DIR"
if [ -n "$LOCAL_CHECKOUT" ]; then
  warn "building your existing checkout in place (no git fetch)."
  ok "source at $(git -C "$SRC_DIR" rev-parse --short HEAD)"
elif [ -d "$SRC_DIR/.git" ]; then
  prev_sha="$(git -C "$SRC_DIR" rev-parse --short HEAD 2>/dev/null || true)"
  log "updating to $TODOMATRIX_REF…"
  # A shallow checkout would make every build report patch 0 (the version's
  # patch number is the commit count — see scripts/version.mjs). Deepen once.
  if [ "$(as_svc git -C "$SRC_DIR" rev-parse --is-shallow-repository 2>/dev/null || echo false)" = true ]; then
    log "deepening shallow checkout (the version's patch number is the commit count)…"
    as_svc git -C "$SRC_DIR" fetch --unshallow --filter=blob:none origin \
      || as_svc git -C "$SRC_DIR" fetch --unshallow origin \
      || warn "could not deepen; this build will report patch 0."
  fi
  as_svc git -C "$SRC_DIR" fetch --filter=blob:none origin "$TODOMATRIX_REF" \
    || as_svc git -C "$SRC_DIR" fetch origin "$TODOMATRIX_REF"
  as_svc git -C "$SRC_DIR" checkout -q -B deploy FETCH_HEAD
  ok "updated $( [ -n "$prev_sha" ] && echo "$prev_sha → " )$(git -C "$SRC_DIR" rev-parse --short HEAD)"
else
  log "cloning $TODOMATRIX_REPO (ref: $TODOMATRIX_REF)…"
  mkdir -p "$PREFIX"
  # NOT --depth 1: the version's patch number is the commit count, and a
  # shallow clone would make every build call itself v2026.8.1 (well, .0 —
  # version.mjs refuses shallow). --filter=blob:none keeps it cheap: the whole
  # commit graph, but only the blobs the checkout needs. Fall back to a plain
  # clone if the server or git is too old for partial clone (needs git >= 2.19).
  git clone --filter=blob:none --branch "$TODOMATRIX_REF" "$TODOMATRIX_REPO" "$SRC_DIR" \
    || git clone --branch "$TODOMATRIX_REF" "$TODOMATRIX_REPO" "$SRC_DIR" \
    || git clone "$TODOMATRIX_REPO" "$SRC_DIR"
  ok "cloned to $SRC_DIR"
fi
chown -R "$SVC_USER" "$PREFIX" 2>/dev/null || true
chown -R "$SVC_USER" "$SRC_DIR" 2>/dev/null || true
[ -f "$SRC_DIR/package.json" ] || die "no package.json at $SRC_DIR — checkout failed?"

# ---------------------------------------------------------------------------
# 4. Build (the service keeps serving the old web root while Vite runs)
# ---------------------------------------------------------------------------
step "[4/6] Build (Vite → $SRC_DIR/dist)"
cd "$SRC_DIR"
if [ -f package-lock.json ]; then as_svc npm ci; else as_svc npm install; fi
as_svc npm run build
[ -f "$SRC_DIR/dist/index.html" ] || die "build produced no dist/index.html"
VERSION="$(as_svc node "$SRC_DIR/scripts/version.mjs" 2>/dev/null || echo 'v?')"
ok "built $VERSION"

# ---------------------------------------------------------------------------
# 5. Swap the web root + systemd unit
# ---------------------------------------------------------------------------
step "[5/6] Web root + systemd service"

# Swap dirs, keeping the previous root for rollback. The service reads files
# per-request, so a swap under it is safe: open files keep their inodes.
rm -rf "$WEB_ROOT.new"
cp -r "$SRC_DIR/dist" "$WEB_ROOT.new"
rm -rf "$WEB_ROOT.prev"
[ -d "$WEB_ROOT" ] && mv "$WEB_ROOT" "$WEB_ROOT.prev"
mv "$WEB_ROOT.new" "$WEB_ROOT"
# serve.mjs is part of the serving path — pin the built tree's copy beside the
# web root so a later source checkout can't change what's running.
cp "$SRC_DIR/scripts/serve.mjs" "$PREFIX/serve.mjs"
chown -R "$SVC_USER" "$WEB_ROOT" "$PREFIX/serve.mjs" 2>/dev/null || true
ok "web root swapped → $WEB_ROOT"

cat > "$UNIT_PATH" <<UNIT
[Unit]
Description=To Do Matrix — Eisenhower-matrix todo PWA (static server)
Documentation=https://github.com/chinmay28/todo-matrix
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$PREFIX
ExecStart=$NODE_BIN $PREFIX/serve.mjs --dir $WEB_ROOT --port $PORT --host $HOST
Restart=on-failure
RestartSec=3

# Hardening — the server only ever reads, so the whole filesystem stays
# read-only to it (no ReadWritePaths at all).
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service" >/dev/null 2>&1 || true
systemctl restart "${SERVICE_NAME}.service"
ok "service enabled and (re)started"

# ---------------------------------------------------------------------------
# 6. Health check (with rollback to the previous web root)
# ---------------------------------------------------------------------------
step "[6/6] Health check"
health_url="http://127.0.0.1:$PORT/healthz"
check_health() {
  for _ in $(seq 1 30); do
    curl -fsS "$health_url" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  return 1
}

if check_health; then
  ok "healthy ($health_url)"
elif [ -d "$WEB_ROOT.prev" ]; then
  warn "$VERSION failed its health check — rolling back to the previous web root…"
  systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true
  rm -rf "$WEB_ROOT"
  mv "$WEB_ROOT.prev" "$WEB_ROOT"
  systemctl start "${SERVICE_NAME}.service"
  if check_health; then
    die "Upgrade to $VERSION failed its health check — rolled back to the previous version. Check: journalctl -u ${SERVICE_NAME} -n 80"
  fi
  die "Upgrade AND rollback both failed health checks. Inspect: journalctl -u ${SERVICE_NAME} -n 80"
else
  die "Service is not healthy. Inspect logs: journalctl -u ${SERVICE_NAME} -n 80 --no-pager"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
lan_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"; [ -n "$lan_ip" ] || lan_ip="<this-host>"

cat <<DONE

${C_GREEN}To Do Matrix $VERSION installed and running.${C_OFF}

  Open it:     http://$lan_ip:$PORT      (http://localhost:$PORT on this machine)
  Web root:    $WEB_ROOT
  Source:      $SRC_DIR (built here)
  Upgrade:     re-run this script — it rebuilds, swaps, and self-heals.

  Manage the service:
    systemctl status  ${SERVICE_NAME}
    systemctl restart ${SERVICE_NAME}
    journalctl -u ${SERVICE_NAME} -f
${C_DIM}
  Tasks live in each browser's localStorage — the server holds no data, so
  upgrades can never lose them (clearing site data in the browser can).
  Installing as an app and offline use need HTTPS (the service worker requires
  a secure context): front this with Tailscale Serve or a reverse proxy
  (Caddy/nginx) rather than exposing plain HTTP beyond localhost.${C_OFF}
DONE
