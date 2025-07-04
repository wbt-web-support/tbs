@echo off
echo RunPod MeloTTS Accent Test
echo ========================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Python not found! Please install Python 3.7+
    pause
    exit /b 1
)

REM Install required packages if needed
echo Installing required packages...
pip install requests >nul 2>&1

REM Run the test
echo.
echo Starting RunPod tests...
echo.
python test_runpod.py

echo.
echo Test complete! Check the output above for results.
echo Generated audio files (if any) are saved in this directory.
pause