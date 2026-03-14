#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/run-and-email.sh --config <config.json> --to <email> [options] [-- <pagesnapguard args>]

Options:
  --config <file>          Config file passed to PageSnapGuard (required)
  --to <email>             Recipient email address (required)
  --from <email>           From email header (default: pagesnapguard@localhost)
  --from-name <text>       From display name (default: PageSnapGuard)
  --subject-prefix <text>  Subject prefix (default: PageSnapGuard)
  --log <file>             Log file path (default: /tmp/pagesnapguard-<timestamp>.log)
  --always                 Send email also on success (default: send only on failure)
  --html-template <file>   HTML template file for email body (optional)
  --html-extra <file>      Extra HTML snippet file appended to the HTML body (optional)
  --verbose, -v            Forward verbose mode to PageSnapGuard
  --update-baseline, -u    Forward baseline update mode to PageSnapGuard
  -h, --help               Show this help

Requirements:
  - msmtp configured (e.g. ~/.msmtprc with an account + auth settings)
  - Built app (dist/index.js exists)

HTML template placeholders:
  {{HOST}} {{CONFIG}} {{EXIT_CODE}} {{STATUS}} {{STATUS_CLASS}} {{LOG_FILE}} {{RUN_OUTPUT}} {{EXTRA_HTML}}
EOF
}

CONFIG_FILE=""
TO_EMAIL=""
FROM_EMAIL="pagesnapguard@localhost"
FROM_NAME="PageSnapGuard"
SUBJECT_PREFIX="PageSnapGuard"
ALWAYS_SEND="false"
LOG_FILE=""
FORWARDED_ARGS=()
HTML_TEMPLATE_FILE=""
HTML_EXTRA_FILE=""

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
    --from-name)
      FROM_NAME="${2:-}"
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
    --html-template)
      HTML_TEMPLATE_FILE="${2:-}"
      shift 2
      ;;
    --html-extra)
      HTML_EXTRA_FILE="${2:-}"
      shift 2
      ;;
    --verbose|-v)
      FORWARDED_ARGS+=("--verbose")
      shift
      ;;
    --update-baseline|-u)
      FORWARDED_ARGS+=("--update-baseline")
      shift
      ;;
    --)
      shift
      FORWARDED_ARGS+=("$@")
      break
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

if [[ -n "$HTML_TEMPLATE_FILE" && ! -f "$HTML_TEMPLATE_FILE" ]]; then
  echo "HTML template file not found: $HTML_TEMPLATE_FILE" >&2
  exit 2
fi

if [[ -n "$HTML_EXTRA_FILE" && ! -f "$HTML_EXTRA_FILE" ]]; then
  echo "HTML extra file not found: $HTML_EXTRA_FILE" >&2
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
if [[ "${#FORWARDED_ARGS[@]}" -gt 0 ]]; then
  echo "Forwarded PageSnapGuard args: ${FORWARDED_ARGS[*]}"
fi

set +e
node dist/index.js --config "$CONFIG_FILE" "${FORWARDED_ARGS[@]}" 2>&1 | tee "$LOG_FILE"
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
LOG_CONTENT="$(cat "$LOG_FILE")"

CHANGED_COUNT="$(printf '%s\n' "$LOG_CONTENT" | awk -F'changed=' '/Page processing summary:/{split($2,a,/[, ]/); print a[1]}' | tail -n 1)"
if [[ "$RUN_EXIT_CODE" -eq 0 && "$CHANGED_COUNT" =~ ^[0-9]+$ && "$CHANGED_COUNT" -gt 0 ]]; then
  STATUS_TEXT="CHANGED"
fi

SUBJECT="${SUBJECT_PREFIX} ${STATUS_TEXT} (exit ${RUN_EXIT_CODE})"

TEXT_BODY="$(cat <<EOF
Host: $HOSTNAME_VALUE
Config: $CONFIG_FILE
Exit code: $RUN_EXIT_CODE
Log file: $LOG_FILE

---- Output ----

$LOG_CONTENT
EOF
)"

format_from_header() {
  local name="$1"
  local email="$2"
  if [[ -n "$name" ]]; then
    printf '%s <%s>' "$name" "$email"
  else
    printf '%s' "$email"
  fi
}

FROM_HEADER_VALUE="$(format_from_header "$FROM_NAME" "$FROM_EMAIL")"

escape_html() {
  sed -e 's/&/\&amp;/g' \
      -e 's/</\&lt;/g' \
      -e 's/>/\&gt;/g'
}

render_html_template() {
  local template="$1"
  local extra_html="$2"
  local escaped_host escaped_config escaped_exit escaped_status escaped_status_class escaped_log_file escaped_output
  local safe_host safe_config safe_exit safe_status safe_status_class safe_log_file safe_output safe_extra_html

  escaped_host="$(printf '%s' "$HOSTNAME_VALUE" | escape_html)"
  escaped_config="$(printf '%s' "$CONFIG_FILE" | escape_html)"
  escaped_exit="$(printf '%s' "$RUN_EXIT_CODE" | escape_html)"
  escaped_status="$(printf '%s' "$STATUS_TEXT" | escape_html)"
  escaped_status_class="fail"
  if [[ "$RUN_EXIT_CODE" -eq 0 ]]; then
    escaped_status_class="ok"
  fi
  escaped_log_file="$(printf '%s' "$LOG_FILE" | escape_html)"
  escaped_output="$(printf '%s' "$LOG_CONTENT" | escape_html)"

  escape_replacement() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//&/\\&}"
    printf '%s' "$value"
  }

  safe_host="$(escape_replacement "$escaped_host")"
  safe_config="$(escape_replacement "$escaped_config")"
  safe_exit="$(escape_replacement "$escaped_exit")"
  safe_status="$(escape_replacement "$escaped_status")"
  safe_status_class="$(escape_replacement "$escaped_status_class")"
  safe_log_file="$(escape_replacement "$escaped_log_file")"
  safe_output="$(escape_replacement "$escaped_output")"
  safe_extra_html="$(escape_replacement "$extra_html")"

  template="${template//\{\{HOST\}\}/$safe_host}"
  template="${template//\{\{CONFIG\}\}/$safe_config}"
  template="${template//\{\{EXIT_CODE\}\}/$safe_exit}"
  template="${template//\{\{STATUS\}\}/$safe_status}"
  template="${template//\{\{STATUS_CLASS\}\}/$safe_status_class}"
  template="${template//\{\{LOG_FILE\}\}/$safe_log_file}"
  template="${template//\{\{RUN_OUTPUT\}\}/$safe_output}"
  template="${template//\{\{EXTRA_HTML\}\}/$safe_extra_html}"
  printf '%s' "$template"
}

if [[ -z "$HTML_TEMPLATE_FILE" ]]; then
  {
    printf 'From: %s\n' "$FROM_HEADER_VALUE"
    printf 'To: %s\n' "$TO_EMAIL"
    printf 'Subject: %s\n' "$SUBJECT"
    printf 'Date: %s\n' "$DATE_VALUE"
    printf 'MIME-Version: 1.0\n'
    printf 'Content-Type: text/plain; charset=UTF-8\n'
    printf '\n'
    printf '%s\n' "$TEXT_BODY"
  } | msmtp -t
else
  BOUNDARY="pagesnapguard-$(date +%s)-$$"
  HTML_TEMPLATE_CONTENT="$(cat "$HTML_TEMPLATE_FILE")"
  HTML_EXTRA_CONTENT=""
  if [[ -n "$HTML_EXTRA_FILE" ]]; then
    HTML_EXTRA_CONTENT="$(cat "$HTML_EXTRA_FILE")"
  fi
  HTML_BODY="$(render_html_template "$HTML_TEMPLATE_CONTENT" "$HTML_EXTRA_CONTENT")"

  {
    printf 'From: %s\n' "$FROM_HEADER_VALUE"
    printf 'To: %s\n' "$TO_EMAIL"
    printf 'Subject: %s\n' "$SUBJECT"
    printf 'Date: %s\n' "$DATE_VALUE"
    printf 'MIME-Version: 1.0\n'
    printf 'Content-Type: multipart/alternative; boundary="%s"\n' "$BOUNDARY"
    printf '\n'
    printf -- '--%s\n' "$BOUNDARY"
    printf 'Content-Type: text/plain; charset=UTF-8\n'
    printf 'Content-Transfer-Encoding: 8bit\n'
    printf '\n'
    printf '%s\n' "$TEXT_BODY"
    printf '\n'
    printf -- '--%s\n' "$BOUNDARY"
    printf 'Content-Type: text/html; charset=UTF-8\n'
    printf 'Content-Transfer-Encoding: 8bit\n'
    printf '\n'
    printf '%s\n' "$HTML_BODY"
    printf '\n'
    printf -- '--%s--\n' "$BOUNDARY"
  } | msmtp -t
fi

echo "Email sent to $TO_EMAIL"
exit "$RUN_EXIT_CODE"
