#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./create-pr.sh \
#   --branch feat/add-token-warning \
#   --file docs/token-warning.md \
#   --title "Add $BEAST token warning & project intro" \
#   --body-file pr_body.md \
#   --github-remote origin

# Defaults
BRANCH=""
FILE=""
TITLE=""
BODY_FILE=""
REMOTE="origin"
BASE_BRANCH="main"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2;;
    --file) FILE="$2"; shift 2;;
    --title) TITLE="$2"; shift 2;;
    --body-file) BODY_FILE="$2"; shift 2;;
    --github-remote) REMOTE="$2"; shift 2;;
    --base) BASE_BRANCH="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ -z "$BRANCH" || -z "$FILE" || -z "$TITLE" || -z "$BODY_FILE" ]]; then
  echo "Missing required arg. See usage in the script header."
  exit 1
fi

echo "Staging changes file: $FILE"
git fetch "$REMOTE" "$BASE_BRANCH"
git checkout -b "$BRANCH" "$REMOTE/$BASE_BRANCH"

# If file exists already, we open an editor? We'll create/overwrite
mkdir -p "$(dirname "$FILE")"
if [[ ! -f "$FILE" ]]; then
  echo "Creating new file: $FILE"
else
  echo "Updating existing file: $FILE"
fi

# Copy provided file content into repo location
cp "$BODY_FILE" "$FILE" || { echo "Failed to copy $BODY_FILE -> $FILE"; exit 1; }

git add "$FILE"
git commit -m "docs: add token warning & project intro (adds $FILE)"
git push --set-upstream "$REMOTE" "$BRANCH"

echo "Pushing complete. Creating PR..."
# Use gh to create PR. If gh is absent, print instructions.
if command -v gh >/dev/null 2>&1; then
  gh pr create --base "$BASE_BRANCH" --head "$BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
  echo "PR created (check terminal output or GitHub)."
else
  echo "gh CLI not found. Installed? https://cli.github.com/"
  echo "To open a PR manually run:"
  echo "  git push --set-upstream $REMOTE $BRANCH"
  echo "  gh pr create --base $BASE_BRANCH --head $BRANCH --title \"$TITLE\" --body-file $BODY_FILE"
fi
