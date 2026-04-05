#!/bin/bash
set -euo pipefail

# Only run in remote/cloud environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

bash "$CLAUDE_PROJECT_DIR/scripts/setup.sh"
