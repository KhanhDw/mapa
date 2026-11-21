# PowerShell Script - File and Directory Tree Management Tool

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Create tmp directory for output files
New-Item -ItemType Directory -Force -Path .\tmp | Out-Null

# Command definitions
$commands = @(
    @{Name = "tree"; Description = "Show directory tree at current location (auto-skips ignored folders/files)" }
    @{Name = "CUSTOM_TREE"; Description = "Show directory tree of selected subdirectories" }
    @{Name = "PATH_TREE"; Description = "Show directory tree at any specified path" }
    @{Name = "CONCAT_TREE"; Description = "Combine directory tree and file contents into one file" }
    @{Name = "MULTI_FILES"; Description = "Combine multiple specific files (from any locations) into one text file" }
)

# ===================================================================
# IGNORE LIST - folders and files that are skipped automatically
# ===================================================================
$script:ExcludeDirNames = @(
    "node_modules", ".next",
    ".git",
    "tmp", "temp", ".tmp",
    ".venv", "venv", "env", ".env", "virtualenv",
    "site-packages",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".tox", ".nox",
    "dist", "build"
)

$script:ExcludeFilePatterns = @(
    "package-lock.json",
    "__init__.*"
)

function Test-IsExcludedDir {
    param([string]$name)
    return ($script:ExcludeDirNames -contains $name)
}

function Test-IsExcludedFile {
    param([string]$name)
    foreach ($pattern in $script:ExcludeFilePatterns) {
        if ($name -like $pattern) { return $true }
    }
    return $false
}

function Get-FilteredFiles {
    param([string]$path)
    $items = Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            if (Test-IsExcludedDir $item.Name) { continue }
            Get-FilteredFiles -path $item.FullName
        }
        else {
            if (Test-IsExcludedFile $item.Name) { continue }
            $item
        }
    }
}

function Generate-Timestamp {
    return Get-Date -Format "yyyyMMdd_HHmmss"
}

function Clean-Path {
    param([string]$path)
    $path = $path -replace "^'", "" -replace "'$", ""
    $path = $path -replace '^"', '' -replace '"$', ""
    return $path
}

function Get-TreeStructure {
    param([string]$path)

    $result = @()
    $items = Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
    Sort-Object -Property { if ($_.PSIsContainer) { 0 } else { 1 } }, Name

    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            if (Test-IsExcludedDir $item.Name) { continue }

            $result += "[$($item.Name)]"
            $subItems = Get-TreeStructure -path $item.FullName
            if ($subItems) {
                $subItems.Split("`n") | ForEach-Object {
                    if ($_) { $result += "  $_" }
                }
            }
        }
        else {
            if (Test-IsExcludedFile $item.Name) { continue }

            if ($item.Length -ge 1GB) {
                $sizeText = "{0:N2} GB" -f ($item.Length / 1GB)
            }
            elseif ($item.Length -ge 1MB) {
                $sizeText = "{0:N2} MB" -f ($item.Length / 1MB)
            }
            elseif ($item.Length -ge 1KB) {
                $sizeText = "{0:N2} KB" -f ($item.Length / 1KB)
            }
            else {
                $sizeText = "$($item.Length) B"
            }

            $result += "$($item.Name) ($sizeText)"
        }
    }
    return $result -join "`n"
}

function Test-IsTextFile {
    param([string]$filePath)
    try {
        $content = Get-Content $filePath -ErrorAction Stop -TotalCount 1
        return $true
    }
    catch {
        return $false
    }
}

function Invoke-CustomTree {
    Write-Host "Enter subdirectory names (space-separated, leave empty to skip):" -ForegroundColor Yellow
    $dirs = Read-Host
    
    if ([string]::IsNullOrWhiteSpace($dirs)) {
        Write-Host "No directories entered. Skipping." -ForegroundColor Yellow
        return
    }
    
    $timestamp = Generate-Timestamp
    $dirList = $dirs -split ' '
    
    foreach ($d in $dirList) {
        if (Test-Path -Path $d -PathType Container) {
            Write-Host "===================" -ForegroundColor Cyan
            Write-Host "Directory tree of: $d" -ForegroundColor Green
            
            $treeOutput = Get-TreeStructure -path $d
            Write-Host $treeOutput
            
            Write-Host "===================" -ForegroundColor Cyan
            
            $safeName = $d -replace '[\\/:*?"<>|]', '_'
            $outputFile = ".\tmp\${safeName}_tree_${timestamp}.txt"
            
            $content = @"
===================
Directory tree of: $d (Timestamp: $(Get-Date))
$treeOutput
===================

"@
            $content | Set-Content -Path $outputFile -Encoding UTF8
            Write-Host "Saved result to file: $outputFile" -ForegroundColor Green
        }
        else {
            Write-Host "Directory '$d' does not exist. Skipping." -ForegroundColor Red
        }
    }
}

function Invoke-PathTree {
    Write-Host "Enter directory path (drag and drop or type path):" -ForegroundColor Yellow
    $targetPath = Read-Host
    $targetPath = Clean-Path $targetPath
    
    if ([string]::IsNullOrWhiteSpace($targetPath)) {
        Write-Host "Empty path. Operation cancelled." -ForegroundColor Red
        return
    }
    
    if (Test-Path -Path $targetPath -PathType Container) {
        $timestamp = Generate-Timestamp
        $dirName = Split-Path $targetPath -Leaf
        $outputFile = ".\tmp\${dirName}_tree_${timestamp}.txt"
        
        Write-Host "===================" -ForegroundColor Cyan
        Write-Host "Directory tree at: $targetPath" -ForegroundColor Green
        
        $treeOutput = Get-TreeStructure -path $targetPath
        Write-Host $treeOutput
        
        Write-Host "===================" -ForegroundColor Cyan
        
        $content = @"
===================
Directory tree at: $targetPath (Timestamp: $(Get-Date))
$treeOutput
===================

"@
        $content | Set-Content -Path $outputFile -Encoding UTF8
        Write-Host "Saved result to file: $outputFile" -ForegroundColor Green
    }
    else {
        Write-Host "Error: Path '$targetPath' does not exist or is not a directory." -ForegroundColor Red
    }
}

function Invoke-ConcatTree {
    Write-Host "Enter source directory path (drag and drop or type):" -ForegroundColor Yellow
    $targetPath = Read-Host
    $targetPath = Clean-Path $targetPath
    
    if ([string]::IsNullOrWhiteSpace($targetPath)) {
        Write-Host "Empty path. Operation cancelled." -ForegroundColor Red
        return
    }
    
    if (-not (Test-Path -Path $targetPath -PathType Container)) {
        Write-Host "Error: Source directory '$targetPath' does not exist." -ForegroundColor Red
        return
    }
    
    $timestamp = Generate-Timestamp
    $dirName = Split-Path $targetPath -Leaf
    $defaultOutput = ".\tmp\${dirName}_combined_${timestamp}.txt"
    
    Write-Host "Enter output filename (just filename, default: $defaultOutput):" -ForegroundColor Yellow
    $outputFilename = Read-Host
    $outputFilename = Clean-Path $outputFilename
    
    if ([string]::IsNullOrWhiteSpace($outputFilename)) {
        $outputFile = $defaultOutput
    }
    else {
        $outputFile = ".\tmp\$((Split-Path $outputFilename -Leaf))"
    }
    
    if (Test-Path $outputFile) {
        Remove-Item $outputFile -Force
    }
    
    Write-Host "Processing... Please wait." -ForegroundColor Yellow
    
    $treeOutput = Get-TreeStructure -path $targetPath
    
    $content = @"
===============================================================================
DIRECTORY TREE STRUCTURE OF: $targetPath
Creation time: $(Get-Date)
===============================================================================
$treeOutput



"@
    
    $allFiles = Get-FilteredFiles -path $targetPath

    $fileCount = 0
    $skippedCount = 0
    
    foreach ($file in $allFiles) {
        $isText = Test-IsTextFile -filePath $file.FullName
        $isLarge = $file.Length -gt 10MB
        
        if ($isText -and -not $isLarge) {
            Write-Host "Processing: $($file.FullName)" -ForegroundColor Gray
            
            $content += @"
===============================================================================
FILE: $($file.FullName)
===============================================================================
"@
            try {
                $fileContent = Get-Content $file.FullName -Encoding UTF8 -ErrorAction Stop -Raw
                $content += $fileContent
                $content += "`n`n"
                $fileCount++
            }
            catch {
                $content += "[Error: Unable to read this file]`n`n"
                $skippedCount++
            }
        }
        else {
            $reason = if (-not $isText) { "binary/non-text" } else { "too large (>10MB)" }
            Write-Host "Skipping ($reason): $($file.FullName)" -ForegroundColor Gray
            $skippedCount++
        }
    }
    
    $content | Set-Content -Path $outputFile -Encoding UTF8
    
    Write-Host "--------------------------------------------------" -ForegroundColor Green
    Write-Host "Success! Created combined file at: $outputFile" -ForegroundColor Green
    Write-Host "Files processed: $fileCount" -ForegroundColor Green
    Write-Host "Files skipped: $skippedCount" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------" -ForegroundColor Green
}

# ===================================================================
# NEW: Combine multiple specific files from any locations
# ===================================================================
function Invoke-MultiFiles {
    Write-Host "Enter file paths (one per line, empty line to finish):" -ForegroundColor Yellow
    Write-Host "  - Relative paths are resolved from current directory: $(Get-Location)" -ForegroundColor DarkGray
    Write-Host "  - Example: src/config.ts" -ForegroundColor DarkGray
    Write-Host "             src/features/auth/storage.ts" -ForegroundColor DarkGray

    $fileList = @()
    while ($true) {
        $line = Read-Host
        if ([string]::IsNullOrWhiteSpace($line)) { break }
        $line = (Clean-Path $line.Trim())
        # Remove surrounding quotes again in case of drag-drop mixed content
        $line = $line -replace "^'", "" -replace "'$", "" -replace '^"', '' -replace '"$', ""
        if ($line) { $fileList += $line }
    }

    if ($fileList.Count -eq 0) {
        Write-Host "No files entered. Operation cancelled." -ForegroundColor Red
        return
    }

    $timestamp = Generate-Timestamp
    $outputFile = ".\tmp\multi_files_${timestamp}.txt"

    Write-Host "`nProcessing $($fileList.Count) file(s)...`n" -ForegroundColor Yellow

    $content = @"
===============================================================================
MULTIPLE FILES CONCATENATION
Creation time: $(Get-Date)
Current dir  : $(Get-Location)
File count   : $($fileList.Count)
===============================================================================

"@

    $fileCount = 0
    $skippedCount = 0
    $missingCount = 0

    foreach ($f in $fileList) {
        $resolved = $f
        if (-not [System.IO.Path]::IsPathRooted($resolved)) {
            $resolved = Join-Path (Get-Location).Path $resolved
        }

        if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
            Write-Host "Not found: $f" -ForegroundColor Red
            $content += @"
===============================================================================
FILE NOT FOUND: $f
===============================================================================

"@
            $missingCount++
            continue
        }

        $fileInfo = Get-Item -LiteralPath $resolved
        Write-Host "Processing: $($fileInfo.FullName)" -ForegroundColor Gray

        $content += @"
===============================================================================
FILE: $($fileInfo.FullName)
===============================================================================
"@

        if (-not (Test-IsTextFile -filePath $fileInfo.FullName)) {
            $content += "[Error: Binary/non-text file, skipped]`n`n"
            Write-Host "Skipping (binary/non-text): $($fileInfo.FullName)" -ForegroundColor Yellow
            $skippedCount++
            continue
        }

        if ($fileInfo.Length -gt 10MB) {
            $content += "[Error: File too large (>10MB), skipped]`n`n"
            Write-Host "Skipping (too large >10MB): $($fileInfo.FullName)" -ForegroundColor Yellow
            $skippedCount++
            continue
        }

        try {
            $fileContent = Get-Content -LiteralPath $fileInfo.FullName -Encoding UTF8 -ErrorAction Stop -Raw
            $content += $fileContent
            $content += "`n`n"
            $fileCount++
        }
        catch {
            $content += "[Error: Unable to read this file]`n`n"
            $skippedCount++
        }
    }

    $content | Set-Content -Path $outputFile -Encoding UTF8

    Write-Host "--------------------------------------------------" -ForegroundColor Green
    Write-Host "Success! Created combined file at: $outputFile" -ForegroundColor Green
    Write-Host "Files processed : $fileCount" -ForegroundColor Green
    Write-Host "Files skipped   : $skippedCount" -ForegroundColor Yellow
    Write-Host "Files not found : $missingCount" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------" -ForegroundColor Green
}

function Show-Menu {
    Clear-Host
    Write-Host "=====================" -ForegroundColor Cyan
    Write-Host "   COMMAND MENU" -ForegroundColor Yellow
    Write-Host "=====================" -ForegroundColor Cyan
    
    for ($i = 0; $i -lt $commands.Count; $i++) {
        Write-Host "$($i+1). $($commands[$i].Description)" -ForegroundColor White
    }
    Write-Host "0. Exit" -ForegroundColor Red
    Write-Host "=====================" -ForegroundColor Cyan
}

while ($true) {
    Show-Menu
    $choice = Read-Host "`nEnter command number (or 0 to exit)"
    
    if ($choice -match '^\d+$') {
        $choiceNum = [int]$choice
        if ($choiceNum -eq 0) {
            Write-Host "Exiting program." -ForegroundColor Green
            break
        }
        elseif ($choiceNum -ge 1 -and $choiceNum -le $commands.Count) {
            $index = $choiceNum - 1
            $cmd = $commands[$index]
            Write-Host "`nRunning: $($cmd.Description)" -ForegroundColor Green
            
            switch ($cmd.Name) {
                "tree" { Write-Host (Get-TreeStructure -path (Get-Location).Path) }
                "CUSTOM_TREE" { Invoke-CustomTree }
                "PATH_TREE" { Invoke-PathTree }
                "CONCAT_TREE" { Invoke-ConcatTree }
                "MULTI_FILES" { Invoke-MultiFiles }
                default {
                    if (Get-Command $cmd.Name -ErrorAction SilentlyContinue) {
                        Invoke-Expression $cmd.Name
                    }
                    else {
                        Write-Host "Command '$($cmd.Name)' not found in PowerShell" -ForegroundColor Red
                    }
                }
            }
            Write-Host "Command execution completed." -ForegroundColor Green
        }
        else {
            Write-Host "Invalid choice. Please enter a number from 0 to $($commands.Count)." -ForegroundColor Red
        }
    }
    else {
        Write-Host "Please enter a valid number." -ForegroundColor Red
    }
    
    Write-Host "`nPress Enter to continue..."
    Read-Host
}