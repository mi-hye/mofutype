#!/bin/sh

set -u

QUALITY_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
QUALITY_REPO_DIR=$(CDPATH= cd -- "$QUALITY_SCRIPT_DIR/../.." && pwd)
QUALITY_PID_FILE="$QUALITY_REPO_DIR/.quality-loop/pid"

touch "$QUALITY_SCRIPT_DIR/STOP"

if [ -f "$QUALITY_PID_FILE" ]; then
  QUALITY_PID=$(cat "$QUALITY_PID_FILE")
  case "$QUALITY_PID" in
    ''|*[!0-9]*)
      printf '%s\n' "Invalid quality-loop PID file; STOP marker was still created."
      exit 1
      ;;
  esac

  if kill -0 "$QUALITY_PID" 2>/dev/null; then
    kill "$QUALITY_PID"
    printf '%s\n' "Stopped quality loop PID $QUALITY_PID."
    exit 0
  fi
fi

printf '%s\n' "STOP marker created; no running quality loop was found."
