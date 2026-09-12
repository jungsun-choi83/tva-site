@echo off
title 이미지 병렬기 - 처음 한 번만
cd /d "%~dp0"
echo.
echo   필요한 부품을 받습니다. 인터넷이 연결돼 있어야 합니다.
echo   처음 한 번만 하면 됩니다. 2~3분 걸립니다.
echo.

py -3 -c "print('ok')" >nul 2>&1
if %errorlevel%==0 (set PY=py -3) else (set PY=python)

%PY% -c "print('ok')" >nul 2>&1
if not %errorlevel%==0 (
  echo   [ 파이썬이 없습니다 ]
  echo   https://www.python.org/downloads/ 에서 설치하세요.
  echo   설치 화면 아래 'Add Python to PATH' 를 꼭 체크하세요.
  pause
  exit /b 1
)

%PY% -m pip install --upgrade pip
%PY% -m pip install httpx pillow customtkinter python-docx python-pptx pypdf

echo.
echo   끝났습니다. 이제 2_실행 을 두 번 누르세요.
pause
