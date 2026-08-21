@echo off
rem 开发：访问 http://localhost:8000/src/ ；生产：http://localhost:8000/dist/
cd /d "%~dp0"
python -m http.server 8000