@echo off
setlocal
cd /d "%~dp0"

echo === [0/4] DOM 名压缩（生成 dist/index.html + dist\ui.tmp.js） ===
node dom_rename.js
if errorlevel 1 goto :fail

echo === [1/4] terser 压缩源码 ===
call terser_compile.bat
if errorlevel 1 goto :fail

echo === [2/4] roadroller 打包 ===
rem npx 实为 npx.cmd，不加 call 会中断本批处理后续命令
rem -O2 用约 300 次尝试调参，比默认再小一点
call npx --no-install roadroller -O2 ..\dist\game.min.js -o ..\dist\game.rolled.js
if errorlevel 1 goto :fail

echo === [3/4] 合并关卡 + 单文件打包 zip ===
rem 合并关卡为单一 lvl.bin（u8 长度前缀 + 指针式加载）
node ..\tools\level_editor\lvl_combine.js
if errorlevel 1 goto :fail
rem 单文件打包：内联 JS + 尾部追加 img+lvl + 打 zip
if exist ..\dist\fallen_rainbow.zip del /Q ..\dist\fallen_rainbow.zip
node package_single.js
if errorlevel 1 goto :fail

echo.
echo === 构建完成 ===
for %%F in (..\dist\game.min.js ..\dist\game.rolled.js ..\dist\fallen_rainbow.zip) do echo %%~nxF: %%~zF bytes
exit /b 0

:fail
echo 构建失败，请确认 terser 与 roadroller 已安装
exit /b 1
