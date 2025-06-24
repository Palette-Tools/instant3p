# NUCLEAR node_modules cleanup - Windows edition
# This script safely removes ONLY node_modules directories

Write-Host "=== NUCLEAR CLEANUP INITIATED ==="
Write-Host "Preparing to obliterate ALL node_modules directories ONLY..."

# Kill processes that might be holding locks on node_modules
Write-Host "Step 1: Killing processes that might lock node_modules..."
$processes = @("node", "electron", "npm", "pnpm", "yarn")
foreach ($proc in $processes) {
    try {
        Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed: $proc"
    } catch {
        # Process not running, ignore
    }
}
Start-Sleep -Seconds 2

Write-Host "Step 2: Finding node_modules directories..."

# Find all node_modules directories
$nodeModulesDirs = @()
try {
    $nodeModulesDirs = Get-ChildItem -Path "." -Name "node_modules" -Recurse -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        (Resolve-Path $_).Path
    }
} catch {
    Write-Host "Error finding directories: $_"
    exit 1
}

$totalFound = $nodeModulesDirs.Count
Write-Host "Found $totalFound node_modules directories"

if ($totalFound -eq 0) {
    Write-Host "No node_modules directories found. Nothing to clean!"
    exit 0
}

# Display what we're about to delete
Write-Host "Will delete the following directories:"
foreach ($dir in $nodeModulesDirs) {
    Write-Host "  - $dir"
}

Write-Host ""
Write-Host "Step 3: Removing node_modules directories..."

$successCount = 0
$failCount = 0

foreach ($dir in $nodeModulesDirs) {
    try {
        # Double-check this is actually a node_modules directory
        if ($dir -notmatch "node_modules$") {
            Write-Host "SAFETY CHECK FAILED: $dir does not end with 'node_modules' - SKIPPING"
            $failCount++
            continue
        }
        
        Write-Host "Removing: $dir"
        
        # Remove the directory and all its contents
        Remove-Item -Path $dir -Recurse -Force -ErrorAction Stop
        
        $successCount++
        Write-Host "  Success"
        
    } catch {
        Write-Host "  Failed: $_"
        $failCount++
        
        # Try alternative removal method for stubborn directories
        try {
            Write-Host "  Trying alternative removal method..."
            cmd /c "rmdir /s /q `"$dir`"" 2>$null
            if (-not (Test-Path $dir)) {
                Write-Host "  Success with alternative method"
                $successCount++
                $failCount--
            }
        } catch {
            Write-Host "  Alternative method also failed"
        }
    }
}

Write-Host ""
Write-Host "=== CLEANUP COMPLETE ==="
Write-Host "Successfully removed: $successCount directories"
Write-Host "Failed to remove: $failCount directories"

# Final verification
Write-Host ""
Write-Host "Verifying cleanup..."
$remaining = @()
try {
    $remaining = Get-ChildItem -Path "." -Name "node_modules" -Recurse -Directory -ErrorAction SilentlyContinue
} catch {
    # Ignore errors during verification
}

$remainingCount = $remaining.Count
Write-Host "Remaining node_modules directories: $remainingCount"

if ($remainingCount -eq 0) {
    Write-Host "SUCCESS: All node_modules directories obliterated!"
    Write-Host "You can now run: pnpm install"
} else {
    Write-Host "WARNING: $remainingCount directories remain"
    Write-Host "Remaining directories:"
    foreach ($dir in $remaining) {
        Write-Host "  - $dir"
    }
    Write-Host ""
    Write-Host "Possible solutions:"
    Write-Host "1. Close all editors and IDEs"
    Write-Host "2. Run this script as Administrator"
    Write-Host "3. Restart your computer"
    Write-Host "4. Check if any processes are still running in Task Manager"
}