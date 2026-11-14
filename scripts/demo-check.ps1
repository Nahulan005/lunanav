
Write-Host "=================================="
Write-Host " LunaNav - Local Demo Check"
Write-Host "=================================="

Write-Host ""
Write-Host "Start the backend in a separate terminal:"
Write-Host "python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

Write-Host ""
Write-Host "Start the frontend in another terminal:"
Write-Host "cd frontend"
Write-Host "npm run dev"

Write-Host ""
Write-Host "Backend health: http://127.0.0.1:8000/api/v1/health"
Write-Host "LOLA sample: http://127.0.0.1:8000/api/v1/terrain/sample?latitude=20&longitude=30"
Write-Host "Frontend: http://localhost:5173"
Write-Host "API docs: http://127.0.0.1:8000/docs"

Write-Host ""
Write-Host "Checking backend health..."

try {
    $health = Invoke-RestMethod `
        -Uri "http://127.0.0.1:8000/api/v1/health" `
        -TimeoutSec 5

    Write-Host "Backend health check completed."
    $health | ConvertTo-Json -Depth 5
}
catch {
    Write-Warning "Backend is unavailable. Start it using the command above."
}

Write-Host ""
Write-Host "Checking LOLA terrain sample..."

try {
    $terrain = Invoke-RestMethod `
        -Uri "http://127.0.0.1:8000/api/v1/terrain/sample?latitude=20&longitude=30" `
        -TimeoutSec 5

    Write-Host "LOLA sample endpoint responded."
    $terrain | ConvertTo-Json -Depth 5
}
catch {
    Write-Warning "LOLA sample unavailable. The local terrain data may not be prepared, or the backend may be unavailable."
}

Write-Host ""
Write-Host "Demo check finished."
