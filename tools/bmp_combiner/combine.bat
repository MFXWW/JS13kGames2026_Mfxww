@echo off
cd /d "%~dp0"
rem 1. 合成统一 112x16 贴图（仅陷阱，16px 高单行；玩家已改为红色碰撞箱）
python unify_images.py
if errorlevel 1 exit /b 1
rem 2. 位压缩编码，横向排版、无 index（rect 由游戏代码提供）
python combiner.py --input-dir processing_images_unified --output-file ..\..\src\assets\img.bin --row-width 112 --horizontal --no-index --foreground-color #000000 --background-color #ff0000
