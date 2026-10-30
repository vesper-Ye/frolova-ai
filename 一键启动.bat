@echo off
chcp 65001 >nul
echo 正在启动弗洛洛...
:: 静默启动后端服务
start "" /B node server.js
:: 等待 3 秒让服务器就绪
timeout /t 3 /nobreak >nul
:: 自动打开默认浏览器
start http://localhost:3000
exit