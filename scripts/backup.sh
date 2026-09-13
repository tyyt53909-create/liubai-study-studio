#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")/.."
mkdir -p backups
BACKUP_FILE=${1:-backups/study-$(date +%Y%m%d-%H%M%S).dump}
mkdir -p "$(dirname "$BACKUP_FILE")"
if docker compose version >/dev/null 2>&1; then
 docker compose exec -T postgres pg_dump -U study -d study -Fc > "$BACKUP_FILE"
else
 docker-compose exec -T postgres pg_dump -U study -d study -Fc > "$BACKUP_FILE"
fi
chmod 600 "$BACKUP_FILE"
printf 'Backup saved: %s\n' "$BACKUP_FILE"
