@echo off
cd /d "%~dp0"
terser ..\src\js\copy.js ..\src\js\utils.js ..\src\js\entities.js ..\src\js\traps.js ..\src\js\traps\trap_bounce.js ..\src\js\traps\trap_button.js ..\src\js\traps\trap_destination.js ..\src\js\traps\trap_floatrect.js ..\src\js\traps\trap_oneway.js ..\src\js\traps\trap_blackhole.js ..\src\js\level_parser.js ..\dist\ui.tmp.js ..\src\js\game_core.js ..\src\js\sound.js --compress --mangle toplevel=true --source-map "url='game.min.js.map'" -o ..\dist\game.min.js --drop-console
