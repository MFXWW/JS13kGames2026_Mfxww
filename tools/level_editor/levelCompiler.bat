@echo off
cd /d "%~dp0"
node node_level_compiler.js
node lvl_combine.js