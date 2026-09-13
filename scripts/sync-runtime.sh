#!/bin/sh
# Reproducible local execution when a cloud-file-provider stalls node_modules.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
STUDY_RUNTIME=${STUDY_RUNTIME:-${HOME:-.}/Codex-Workspace/runtime/dse-study-studio}
mkdir -p "$STUDY_RUNTIME"
rsync -ac --exclude=.git --exclude=node_modules --exclude=dist --exclude=.env --exclude=artifacts --exclude=test-results --exclude=backups "$ROOT/" "$STUDY_RUNTIME/"
printf '%s\n' "$STUDY_RUNTIME"
