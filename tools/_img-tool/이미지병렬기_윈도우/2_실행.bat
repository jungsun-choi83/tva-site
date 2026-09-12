@echo off
title 이미지 병렬기
cd /d "%~dp0"

rem 기본 모델은 지금 계정에서 거부됩니다. 코덱스 설정의 모델 이름으로 맞춥니다.
set CODEX_IMAGEGEN_MODEL=gpt-5.6-sol

py -3 -c "print('ok')" >nul 2>&1
if %errorlevel%==0 (set PY=py -3) else (set PY=python)

%PY% "이미지병렬기.py"

if not %errorlevel%==0 (
  echo.
  echo   [ 열지 못했습니다 ]
  echo   1_처음에_한번만 을 먼저 실행하셨나요?
  echo   로그인 파일이 없다는 말이 나오면 읽어주세요.txt 를 보세요.
  pause
)
