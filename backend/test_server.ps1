# Test the server without interfering with it
Write-Host "Testing server endpoint..."
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "✅ SUCCESS: Server is responding!"
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Response:"
    Write-Host $response.Content
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)"
    exit 1
}
