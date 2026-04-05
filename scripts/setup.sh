#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing contracts dependencies..."
cd "$REPO_ROOT/contracts"
npm install

echo "Installing frontend dependencies..."
cd "$REPO_ROOT/frontend"
npm install

echo "Setup complete."
