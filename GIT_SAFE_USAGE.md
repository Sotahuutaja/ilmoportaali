# Git Safe Usage

To avoid stale git lock file issues in this workspace, use `git-safe` or `git-push` scripts:

## Quick Push (add + commit + push in 1 command)

**Windows:**
```bash
.\git-push.bat "Your commit message here"
```

**Linux/Mac:**
```bash
chmod +x git-push.sh
./git-push.sh "Your commit message here"
```

## Individual Commands (git-safe wrapper)

**Windows:**
```bash
.\git-safe.bat add file.txt
.\git-safe.bat commit -m "message"
.\git-safe.bat push
```

**Linux/Mac:**
```bash
chmod +x git-safe.sh
./git-safe.sh add file.txt
./git-safe.sh commit -m "message"
./git-safe.sh push
```

## Alias (optional)
To make it even easier, add an alias to your shell profile:

**Windows PowerShell** (`$PROFILE`):
```powershell
Set-Alias git-safe ".\git-safe.bat"
```

**Linux/Mac** (`.bashrc` or `.zshrc`):
```bash
alias git-safe='./git-safe.sh'
```

Then you can just use:
```bash
git-safe add file.txt
git-safe commit -m "message"
git-safe push
```

## What it does
The script automatically cleans up stale lock files (`.lock`, `gc.pid`, `tmp_obj*`) before executing any git command. This prevents the "Unable to create index.lock: File exists" errors that can occur in certain workspace environments.
