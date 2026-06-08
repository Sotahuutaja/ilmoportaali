@echo off
REM Git helper that cleans locks, stages all changes, commits, and pushes in one command
REM Usage: git-push "commit message"

setlocal enabledelayedexpansion

REM Check if commit message was provided
if "%~1"=="" (
  echo Usage: git-push "Your commit message here"
  exit /b 1
)

REM Clean stale git locks
if exist ".git" (
  for /f "delims=" %%f in ('dir /s /b .git\*.lock 2^>nul') do del /f /q "%%f" 2>nul
  for /f "delims=" %%f in ('dir /s /b .git\gc.pid 2^>nul') do del /f /q "%%f" 2>nul
  for /f "delims=" %%f in ('dir /s /b .git\tmp_obj* 2^>nul') do del /f /q "%%f" 2>nul
)

echo Staging changes...
git add -A
if %errorlevel% neq 0 (
  echo Error during git add
  exit /b 1
)

echo Committing with message: %~1
git commit -m "%~1"
if %errorlevel% neq 0 (
  echo Error during git commit
  exit /b 1
)

echo Pushing to remote...
git push
if %errorlevel% neq 0 (
  echo Error during git push
  exit /b 1
)

echo Success! Changes pushed.
