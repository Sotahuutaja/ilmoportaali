#!/bin/bash
# Git wrapper that cleans stale locks before running git commands
# Usage: ./git-safe.sh add file.txt
#        ./git-safe.sh commit -m "message"
#        ./git-safe.sh push

cleanup_git_locks() {
  local git_dir=".git"
  if [ -d "$git_dir" ]; then
    # Remove stale lock files silently
    find "$git_dir" -name "*.lock" 2>/dev/null | xargs rm -f 2>/dev/null || true
    find "$git_dir" -name "gc.pid" 2>/dev/null | xargs rm -f 2>/dev/null || true
    find "$git_dir" -name "tmp_obj*" 2>/dev/null | xargs rm -f 2>/dev/null || true
  fi
}

cleanup_git_locks
exec git "$@"
