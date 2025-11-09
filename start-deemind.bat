@echo off
set PROJECT_ROOT=C:\Users\Bakheet\Documents\peojects\deemind
set DASHBOARD_DIR=%PROJECT_ROOT%\dashboard

echo 🚀 Starting Deemind service...
start "Deemind Service" cmd /k "cd /d %PROJECT_ROOT% && npm run service:start"
TIMEOUT /T 3 >NUL

echo 🖥  Starting Deemind dashboard...
start "Deemind Dashboard" cmd /k "cd /d %DASHBOARD_DIR% && npm run dev -- --host 127.0.0.1 --port 5758 --strictPort"
TIMEOUT /T 5 >NUL

echo 🌐 Opening dashboard UI...
start "" http://localhost:5758
