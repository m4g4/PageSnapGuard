#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/run-and-email.sh --config <config.json> --to <email> [options]

Options:
  --config <file>          Config file passed to PageSnapGuard (required)
  --to <email>             Recipient email address (required)
  --from <email>           From email header (default: pagesnapguard@localhost)
  --subject-prefix <text>  Subject prefix (default: PageSnapGuard)
  --log <file>             Log file path (default: /tmp/pagesnapguard-<timestamp>.log)
  --always                 Send email also on success (default: send only on failure)
  -h, --help               Show this help

Requirements:
  - msmtp configured (e.g. ~/.msmtprc with an account + auth settings)
  - Built app (dist/index.js exists)
EOF
}

CONFIG_FILE=""
TO_EMAIL=""
FROM_EMAIL="pagesnapguard@localhost"
SUBJECT_PREFIX="PageSnapGuard"
ALWAYS_SEND="false"
LOG_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      CONFIG_FILE="${2:-}"
      shift 2
      ;;
    --to)
      TO_EMAIL="${2:-}"
      shift 2
      ;;
    --from)
      FROM_EMAIL="${2:-}"
      shift 2
      ;;
    --subject-prefix)
      SUBJECT_PREFIX="${2:-}"
      shift 2
      ;;
    --log)
      LOG_FILE="${2:-}"
      shift 2
      ;;
    --always)
      ALWAYS_SEND="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$CONFIG_FILE" || -z "$TO_EMAIL" ]]; then
  echo "Both --config and --to are required." >&2
  usage
  exit 2
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Config file not found: $CONFIG_FILE" >&2
  exit 2
fi

if [[ ! -f "dist/index.js" ]]; then
  echo "dist/index.js not found. Run 'npm run build' first." >&2
  exit 2
fi

if ! command -v msmtp >/dev/null 2>&1; then
  echo "msmtp is not installed or not in PATH." >&2
  echo "Install on Debian: sudo apt install msmtp msmtp-mta ca-certificates" >&2
  exit 2
fi

if [[ -z "$LOG_FILE" ]]; then
  LOG_FILE="/tmp/pagesnapguard-$(date +%Y%m%d-%H%M%S).log"
fi

echo "Running PageSnapGuard with config: $CONFIG_FILE"
echo "Log file: $LOG_FILE"

set +e
node dist/index.js --config "$CONFIG_FILE" 2>&1 | tee "$LOG_FILE"
RUN_EXIT_CODE=${PIPESTATUS[0]}
set -e

STATUS_TEXT="FAILED"
if [[ "$RUN_EXIT_CODE" -eq 0 ]]; then
  STATUS_TEXT="SUCCESS"
fi

if [[ "$RUN_EXIT_CODE" -eq 0 && "$ALWAYS_SEND" != "true" ]]; then
  echo "Run succeeded. Skipping email (use --always to send on success)."
  exit 0
fi

HOSTNAME_VALUE="$(hostname 2>/dev/null || echo unknown-host)"
DATE_VALUE="$(date -R)"

SUBJECT="${SUBJECT_PREFIX} ${STATUS_TEXT} (exit ${RUN_EXIT_CODE})"

{
  printf 'From: %s\n' "$FROM_EMAIL"
  printf 'To: %s\n' "$TO_EMAIL"
  printf 'Subject: %s\n' "$SUBJECT"
  printf 'Date: %s\n' "$DATE_VALUE"
  printf 'MIME-Version: 1.0\n'
  printf 'Content-Type: text/plain; charset=UTF-8\n'
  printf '\n'
  printf 'Host: %s\n' "$HOSTNAME_VALUE"
  printf 'Config: %s\n' "$CONFIG_FILE"
  printf 'Exit code: %s\n' "$RUN_EXIT_CODE"
  printf 'Log file: %s\n' "$LOG_FILE"
  printf '\n---- Output ----\n\n'
  cat "$LOG_FILE"
} | msmtp -t

echo "Email sent to $TO_EMAIL"
exit "$RUN_EXIT_CODE"
