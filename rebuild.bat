@echo off
REM Quick rebuild wrapper
powershell -ExecutionPolicy Bypass -File "%~dp0rebuild.ps1" %*

