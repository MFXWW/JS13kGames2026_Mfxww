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

echo === [3/4] 同步运行资源并打包 zip ===
rem 合并关卡为单一 lvl.bin（长度前缀 + 指针式加载）
node ..\tools\level_editor\lvl_combine.js
if errorlevel 1 goto :fail
rem 精灵图是游戏运行必需文件，从 src\assets 刷新到 dist
copy /Y ..\src\assets\img.bin ..\dist\ >nul
rem 用合并后的关卡文件刷新 dist\lvl（游戏按 lvl\lvl.bin 加载）
if exist ..\dist\lvl rmdir /S /Q ..\dist\lvl
mkdir ..\dist\lvl
copy /Y ..\src\assets\lvl\lvl.bin ..\dist\lvl\ >nul
rem 打包运行所需文件（不含中间产物 min.js / map；zip 放 dist 内）
rem 用 zopfli（最优 deflate）打包，比 Compress-Archive 更小
if exist ..\dist\fallen_rainbow.zip del /Q ..\dist\fallen_rainbow.zip
node zopfli_zip.js ..\dist\fallen_rainbow.zip
if errorlevel 1 goto :fail

echo.
echo === 构建完成 ===
for %%F in (..\dist\game.min.js ..\dist\game.rolled.js ..\dist\fallen_rainbow.zip) do echo %%~nxF: %%~zF bytes
exit /b 0

:fail
echo 构建失败，请确认 terser 与 roadroller 已安装
exit /b 1
