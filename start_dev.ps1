# Launch ResearchMate AI Backend (port 8000) and Frontend (port 5173)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-PortListening([int]$Port) {
    foreach ($hostAddr in @("127.0.0.1", "::1")) {
        try {
            $family = if ($hostAddr -eq "::1") { [System.Net.Sockets.AddressFamily]::InterNetworkV6 } else { [System.Net.Sockets.AddressFamily]::InterNetwork }
            $conn = New-Object System.Net.Sockets.TcpClient($family)
            $conn.Connect($hostAddr, $Port)
            $conn.Close()
            return $true
        } catch {
        }
    }
    return $false
}

if (Test-PortListening 8000) {
    Write-Host "ResearchMate AI Backend is already running on http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Host "Starting ResearchMate AI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
    Start-Process -FilePath "$root\backend\.venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" -WorkingDirectory "$root\backend"
}

$npmCmd = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue).Source
if (-not $npmCmd -and (Test-Path "$env:LOCALAPPDATA\NodeJS\npm.cmd")) {
    $npmCmd = "$env:LOCALAPPDATA\NodeJS\npm.cmd"
}
if (-not $npmCmd) {
    throw "npm.cmd was not found on PATH or in $env:LOCALAPPDATA\NodeJS."
}

if (Test-PortListening 5173) {
    Write-Host "ResearchMate AI Frontend is already running on http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "Starting ResearchMate AI Frontend on http://localhost:5173 ..." -ForegroundColor Cyan
    Start-Process -FilePath $npmCmd -ArgumentList "run", "dev", "--", "--port", "5173" -WorkingDirectory "$root\frontend"
}

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173/"
