@echo off
cd /d "%~dp0"
rem 1. 合成统一 192x32 贴图（陷阱+玩家，黑前景/透明背景）
python unify_images.py
if errorlevel 1 exit /b 1
rem 2. 位压缩编码，横向排版、无 index（rect 由游戏代码提供）
python combiner.py --input-dir processing_images_unified --output-file ..\..\src\assets\img.bin --row-width 192 --horizontal --no-index --foreground-color #000000 --background-color #ff0000
