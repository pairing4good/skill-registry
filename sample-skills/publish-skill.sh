#!/usr/bin/env bash
# Publish a skill directory to an Artifactory Skills repository.
# Usage: ./publish-skill.sh <skill-directory>
#
# Reads connection config from .env in the same directory as this script.
# Required .env vars:
#   ARTIFACTORY_PLATFORM_URL   — e.g. https://yourinstance.jfrog.io
#   ARTIFACTORY_REPOSITORY     — e.g. skills-registry-local
#   ARTIFACTORY_AUTH_METHOD    — "bearer" or "basic"
#   ARTIFACTORY_ACCESS_TOKEN   — identity token (when AUTH_METHOD=bearer)
#   ARTIFACTORY_USERNAME       — username  (when AUTH_METHOD=basic)
#   ARTIFACTORY_IDENTITY_TOKEN — password/token (when AUTH_METHOD=basic)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  # Only set variables from .env if they are not already in the environment
  while IFS='=' read -r key rest; do
    [[ -z "$key" ]] && continue
    if [[ -z "${!key+x}" ]]; then
      export "$key=$rest"
    fi
  done < <(grep -E '^[A-Z_]+=.+' "$ENV_FILE")
fi

# ---------------------------------------------------------------------------
# Validate arguments
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-directory>" >&2
  exit 1
fi

SKILL_DIR="${1%/}"

if [[ ! -d "$SKILL_DIR" ]]; then
  echo "Error: directory not found: $SKILL_DIR" >&2
  exit 1
fi

SKILL_MD="$SKILL_DIR/SKILL.md"
if [[ ! -f "$SKILL_MD" ]]; then
  echo "Error: SKILL.md not found in $SKILL_DIR" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Validate required config
# ---------------------------------------------------------------------------
: "${ARTIFACTORY_PLATFORM_URL:?ARTIFACTORY_PLATFORM_URL is not set}"
: "${ARTIFACTORY_REPOSITORY:?ARTIFACTORY_REPOSITORY is not set}"
AUTH_METHOD="${ARTIFACTORY_AUTH_METHOD:-bearer}"

# ---------------------------------------------------------------------------
# Parse SKILL.md YAML frontmatter
# ---------------------------------------------------------------------------
parse_frontmatter() {
  local file="$1"
  local key="$2"
  awk '/^---/{count++; next} count==1' "$file" | grep -E "^${key}:" | head -1 | sed "s/^${key}:[[:space:]]*//" | tr -d '"'"'"
}

SKILL_NAME="$(parse_frontmatter "$SKILL_MD" "name")"
SKILL_VERSION="$(parse_frontmatter "$SKILL_MD" "version")"
SKILL_DESCRIPTION="$(parse_frontmatter "$SKILL_MD" "description")"
SKILL_AUTHOR="$(parse_frontmatter "$SKILL_MD" "author")"

# Parse tags: [tag1, tag2, tag3] → comma-separated string
RAW_TAGS="$(parse_frontmatter "$SKILL_MD" "tags")"
_TAGS_PY="$(mktemp /tmp/tags_XXXXXX.py)"
cat > "$_TAGS_PY" <<'PYEOF'
import sys
raw = sys.stdin.read().strip().lstrip('[').rstrip(']')
parts = [t.strip().strip('"').strip("'") for t in raw.split(',') if t.strip()]
print(','.join(parts))
PYEOF
SKILL_TAGS="$(echo "$RAW_TAGS" | python3 "$_TAGS_PY")"
rm -f "$_TAGS_PY"

if [[ -z "$SKILL_NAME" || -z "$SKILL_VERSION" ]]; then
  echo "Error: could not parse 'name' and 'version' from $SKILL_MD frontmatter" >&2
  exit 1
fi

echo "Publishing skill:"
echo "  name    : $SKILL_NAME"
echo "  version : $SKILL_VERSION"
echo "  author  : $SKILL_AUTHOR"
echo "  tags    : $SKILL_TAGS"
echo ""

# ---------------------------------------------------------------------------
# Build authentication args
# ---------------------------------------------------------------------------
CURL_AUTH=()
if [[ "$AUTH_METHOD" == "bearer" ]]; then
  : "${ARTIFACTORY_ACCESS_TOKEN:?ARTIFACTORY_ACCESS_TOKEN is not set}"
  CURL_AUTH=(-H "Authorization: Bearer ${ARTIFACTORY_ACCESS_TOKEN}")
else
  : "${ARTIFACTORY_USERNAME:?ARTIFACTORY_USERNAME is not set (required for basic auth)}"
  : "${ARTIFACTORY_IDENTITY_TOKEN:?ARTIFACTORY_IDENTITY_TOKEN is not set (required for basic auth)}"
  CURL_AUTH=(-u "${ARTIFACTORY_USERNAME}:${ARTIFACTORY_IDENTITY_TOKEN}")
fi

BASE_URL="${ARTIFACTORY_PLATFORM_URL}/artifactory/${ARTIFACTORY_REPOSITORY}/${SKILL_NAME}/${SKILL_VERSION}"
STORAGE_URL="${ARTIFACTORY_PLATFORM_URL}/artifactory/api/storage/${ARTIFACTORY_REPOSITORY}/${SKILL_NAME}/${SKILL_VERSION}"

# ---------------------------------------------------------------------------
# Upload all files in the skill directory
# ---------------------------------------------------------------------------
UPLOAD_OK=true
while IFS= read -r -d '' filepath; do
  # Relative path within the skill directory
  relpath="${filepath#${SKILL_DIR}/}"
  dest_url="${BASE_URL}/${relpath}"

  echo "Uploading: $relpath → $dest_url"
  HTTP_STATUS="$(curl -sS -o /dev/null -w "%{http_code}" \
    "${CURL_AUTH[@]}" \
    -X PUT \
    --data-binary "@${filepath}" \
    "$dest_url")"

  if [[ "$HTTP_STATUS" =~ ^2 ]]; then
    echo "  HTTP $HTTP_STATUS OK"
  else
    echo "  HTTP $HTTP_STATUS FAILED" >&2
    UPLOAD_OK=false
  fi
done < <(find "$SKILL_DIR" -type f -print0)

if [[ "$UPLOAD_OK" != "true" ]]; then
  echo ""
  echo "One or more file uploads failed." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Set skill.* properties on SKILL.md for search indexing
# ---------------------------------------------------------------------------
echo ""
echo "Setting skill properties on SKILL.md..."

# URL-encode a value
urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

PROPS="skill.name=$(urlencode "$SKILL_NAME")"
PROPS="${PROPS};skill.version=$(urlencode "$SKILL_VERSION")"
[[ -n "$SKILL_AUTHOR" ]]      && PROPS="${PROPS};skill.author=$(urlencode "$SKILL_AUTHOR")"
[[ -n "$SKILL_DESCRIPTION" ]] && PROPS="${PROPS};skill.description=$(urlencode "$SKILL_DESCRIPTION")"
[[ -n "$SKILL_TAGS" ]]        && PROPS="${PROPS};skill.tags=$(urlencode "$SKILL_TAGS")"

PROP_STATUS="$(curl -sS -o /dev/null -w "%{http_code}" \
  "${CURL_AUTH[@]}" \
  -X PUT \
  "${STORAGE_URL}/SKILL.md?properties=${PROPS}")"

if [[ "$PROP_STATUS" =~ ^2 ]]; then
  echo "  HTTP $PROP_STATUS OK"
else
  echo "  HTTP $PROP_STATUS FAILED — properties not set" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "Skill published successfully."
echo "  Download : ${BASE_URL}/SKILL.md"
echo "  Search   : ${ARTIFACTORY_PLATFORM_URL}/artifactory/api/skills/${ARTIFACTORY_REPOSITORY}/api/v1/search?q=${SKILL_NAME}"
