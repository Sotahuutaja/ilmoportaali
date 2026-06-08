#!/bin/bash
# Git helper that cleans locks, stages all changes, commits, and pushes in one command
# Usage: ./git-push.sh "commit message"

cleanup_git_locks() {
  local git_dir=".git"
  if [ -d "$git_dir" ]; then
    find "$git_dir" -name "*.lock" 2>/dev/null | xargs rm -f 2>/dev/null || true
    find "$git_dir" -name "gc.pid" 2>/dev/null | xargs rm -f 2>/dev/null || true
    find "$git_dir" -name "tmp_obj*" 2>/dev/null | xargs rm -f 2>/dev/null || true
  fi
}

if [ -z "$1" ]; then
  echo "Usage: ./git-push.sh \"Your commit message here\""
  exit 1
fi

cleanup_git_locks

echo "Staging changes..."
git add -A || exit 1

echo "Committing with message: $1"
git commit -m "$1" || exit 1

echo "Pushing to remote..."
git push || exit 1

echo "Success! Changes pushed."
