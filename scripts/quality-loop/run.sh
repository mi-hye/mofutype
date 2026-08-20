#!/bin/sh

set -u

QUALITY_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
QUALITY_REPO_DIR=$(CDPATH= cd -- "$QUALITY_SCRIPT_DIR/../.." && pwd)
QUALITY_STATE_DIR="$QUALITY_REPO_DIR/.quality-loop"
QUALITY_RUNS_DIR="$QUALITY_STATE_DIR/runs"
QUALITY_STOP_FILE="$QUALITY_SCRIPT_DIR/STOP"
QUALITY_READY_FILE="$QUALITY_SCRIPT_DIR/READY"
QUALITY_PID_FILE="$QUALITY_STATE_DIR/pid"
QUALITY_INTERVAL_SECONDS=${QUALITY_INTERVAL_SECONDS:-600}
QUALITY_PORT=${QUALITY_PORT:-3110}
QUALITY_SERVER_PID=""

mkdir -p "$QUALITY_RUNS_DIR"
printf '%s\n' "$$" > "$QUALITY_PID_FILE"

cleanup_quality_loop() {
  if [ -n "$QUALITY_SERVER_PID" ] && kill -0 "$QUALITY_SERVER_PID" 2>/dev/null; then
    kill "$QUALITY_SERVER_PID" 2>/dev/null || true
    wait "$QUALITY_SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$QUALITY_PID_FILE"
}

trap cleanup_quality_loop EXIT
trap 'exit 0' INT TERM HUP

while :; do
  if [ -f "$QUALITY_STOP_FILE" ]; then
    printf '%s\n' "Stopped by STOP marker." >> "$QUALITY_STATE_DIR/status.log"
    exit 0
  fi
  if [ -f "$QUALITY_READY_FILE" ]; then
    printf '%s\n' "Stopped because the Goal marked the product ready." >> "$QUALITY_STATE_DIR/status.log"
    exit 0
  fi

  QUALITY_RUN_ID=$(date '+%Y%m%d-%H%M%S')
  QUALITY_RUN_DIR="$QUALITY_RUNS_DIR/$QUALITY_RUN_ID"
  QUALITY_LOG_FILE="$QUALITY_RUN_DIR/checks.log"
  mkdir -p "$QUALITY_RUN_DIR"

  cd "$QUALITY_REPO_DIR" || exit 1

  if [ -n "$(git status --short --untracked-files=no)" ]; then
    printf '%s %s\n' "$QUALITY_RUN_ID" "Skipped: tracked files are being edited." \
      | tee -a "$QUALITY_STATE_DIR/status.log" "$QUALITY_LOG_FILE"
  else
    printf '%s %s\n' "$QUALITY_RUN_ID" "Starting quality checkpoint." \
      | tee -a "$QUALITY_STATE_DIR/status.log" "$QUALITY_LOG_FILE"

    QUALITY_CHECKS_PASSED=true
    npm test >> "$QUALITY_LOG_FILE" 2>&1 || QUALITY_CHECKS_PASSED=false
    npm run typecheck >> "$QUALITY_LOG_FILE" 2>&1 || QUALITY_CHECKS_PASSED=false
    npm run lint >> "$QUALITY_LOG_FILE" 2>&1 || QUALITY_CHECKS_PASSED=false
    if curl --silent --fail "http://127.0.0.1:54321/auth/v1/health" >/dev/null 2>&1; then
      npm run test:e2e >> "$QUALITY_LOG_FILE" 2>&1 || QUALITY_CHECKS_PASSED=false
    else
      printf '%s\n' "SKIP: local Supabase is unavailable; dynamic purchase-flow E2E was not run." \
        >> "$QUALITY_LOG_FILE"
    fi
    npm run build >> "$QUALITY_LOG_FILE" 2>&1 || QUALITY_CHECKS_PASSED=false

    if [ "$QUALITY_CHECKS_PASSED" = true ]; then
      npm run start -- --hostname 127.0.0.1 --port "$QUALITY_PORT" \
        >> "$QUALITY_LOG_FILE" 2>&1 &
      QUALITY_SERVER_PID=$!

      QUALITY_SERVER_READY=false
      QUALITY_ATTEMPT=0
      while [ "$QUALITY_ATTEMPT" -lt 30 ]; do
        if curl --silent --fail "http://127.0.0.1:$QUALITY_PORT" >/dev/null 2>&1; then
          QUALITY_SERVER_READY=true
          break
        fi
        QUALITY_ATTEMPT=$((QUALITY_ATTEMPT + 1))
        sleep 1
      done

      if [ "$QUALITY_SERVER_READY" = true ]; then
        QUALITY_BASE_URL="http://127.0.0.1:$QUALITY_PORT" \
          QUALITY_OUTPUT_DIR="$QUALITY_RUN_DIR" \
          node scripts/quality-loop/audit.mjs >> "$QUALITY_LOG_FILE" 2>&1 \
          || QUALITY_CHECKS_PASSED=false
      else
        QUALITY_CHECKS_PASSED=false
        printf '%s\n' "Production server did not become ready." >> "$QUALITY_LOG_FILE"
      fi

      if kill -0 "$QUALITY_SERVER_PID" 2>/dev/null; then
        kill "$QUALITY_SERVER_PID" 2>/dev/null || true
        wait "$QUALITY_SERVER_PID" 2>/dev/null || true
      fi
      QUALITY_SERVER_PID=""
    fi

    if [ "$QUALITY_CHECKS_PASSED" = true ]; then
      printf '%s %s\n' "$QUALITY_RUN_ID" "PASS: deterministic checks passed; Goal review still required." \
        | tee -a "$QUALITY_STATE_DIR/status.log"
    else
      printf '%s %s\n' "$QUALITY_RUN_ID" "FAIL: inspect $QUALITY_LOG_FILE" \
        | tee -a "$QUALITY_STATE_DIR/status.log"
    fi
  fi

  sleep "$QUALITY_INTERVAL_SECONDS" &
  wait $!
done
