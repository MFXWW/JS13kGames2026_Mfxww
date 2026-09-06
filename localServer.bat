@echo off
rem 生产：http://localhost:8000/dist/（先 npm run build）
rem 开发调试：node build\_make_verify.js 生成后访问 http://localhost:8000/build/_verify/index.html
cd /d "%~dp0"
python -m http.server 8000