@echo off
REM Git wrapper that cleans stale locks before running git commands
REM Usage: git-safe add file.txt
REM        git-safe commit -m "message"
REM        git-safe push

setlocal enabledelayedexpansion

REM Clean stale git locks
if exist ".git" (
  for /f "delims=" %%f in ('dir /s /b .git\*.lock 2^>nul') do del /f /q "%%f" 2>nul
  for /f "delims=" %%f in ('dir /s /b .git\gc.pid 2^>nul') do del /f /q "%%f" 2>nul
  for /f "delims=" %%f in ('dir /s /b .git\tmp_obj* 2^>nul') do del /f /q "%%f" 2>nul
)

REM Run git with all arguments passed through
git %*
