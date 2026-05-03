param([string]$action = "restart")  # start | stop | restart

$root = $PSScriptRoot

function Stop-Servers {
    foreach ($port in 8000, 5173, 5174, 5175, 5176, 5177) {
        $lines = netstat -ano | Select-String ":${port}\s.*LISTENING"
        foreach ($line in $lines) {
            $procPid = ($line.Line.Trim() -split '\s+')[-1]
            if ($procPid -match '^\d+$' -and [int]$procPid -ne $PID) {
                taskkill /PID $procPid /F 2>$null | Out-Null
            }
        }
    }
    Write-Host "Servers stopped."
}

function Start-Servers {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; py -3.12 -m uvicorn main:app --reload --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
    Write-Host "Servers started in new windows."
}

switch ($action) {
    "stop"    { Stop-Servers }
    "start"   { Start-Servers }
    default   { Stop-Servers; Start-Servers }
}
