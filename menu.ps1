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
)

# ===================================================================
# IGNORE LIST - folders and files that are skipped automatically
# ===================================================================
# Folders: matched by exact name (case-insensitive) at ANY depth.
# The whole folder is skipped, including everything inside it.
$script:ExcludeDirNames = @(
    # Node.js / Next.js
    "node_modules", ".next",
    # Git
    ".git",
    # Temp folders
    "tmp", "temp", ".tmp",
    # Python virtual environments
    ".venv", "venv", "env", ".env", "virtualenv",
    # Python libraries
    "site-packages",
    # Python caches
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    # Test environments
    ".tox", ".nox",
    # Build output
    "dist", "build"
)

# Files: matched by file name, wildcards allowed (case-insensitive)
$script:ExcludeFilePatterns = @(
    "package-lock.json",
    "__init__.*"
)

# Check if a directory name is in the ignore list
function Test-IsExcludedDir {
    param([string]$name)
    return ($script:ExcludeDirNames -contains $name)
}

# Check if a file name is in the ignore list
function Test-IsExcludedFile {
    param([string]$name)
    foreach ($pattern in $script:ExcludeFilePatterns) {
        if ($name -like $pattern) { return $true }
    }
    return $false
}

# Recursively list files, skipping ignored folders WITHOUT entering them
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

# Function to generate timestamp
function Generate-Timestamp {
    return Get-Date -Format "yyyyMMdd_HHmmss"
}

# Function to clean dragged path
function Clean-Path {
    param([string]$path)
    $path = $path -replace "^'", "" -replace "'$", ""
    $path = $path -replace '^"', '' -replace '"$', ''
    return $path
}

# Function to get tree structure (skips everything in the ignore list)
function Get-TreeStructure {
    param([string]$path)

    $result = @()
    $items = Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
    Sort-Object -Property { if ($_.PSIsContainer) { 0 } else { 1 } }, Name

    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            if (Test-IsExcludedDir $item.Name) { continue }

            $result += "[$($item.Name)]"
            # Recursively get sub-items
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

# Function to check if file is text
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

# Custom Tree function
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
            
            # Save output to file in tmp directory with timestamp
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

# Path Tree function
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
        
        # Save output to file
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

# Concat Tree function - Combine tree and file contents
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
    
    # Remove old file if exists
    if (Test-Path $outputFile) {
        Remove-Item $outputFile -Force
    }
    
    Write-Host "Processing... Please wait." -ForegroundColor Yellow
    
    # 1. Write directory tree to output file
    $treeOutput = Get-TreeStructure -path $targetPath
    
    $content = @"
===============================================================================
DIRECTORY TREE STRUCTURE OF: $targetPath
Creation time: $(Get-Date)
===============================================================================
$treeOutput



"@
    
    # 2. Collect all files (ignored folders/files are skipped automatically)
    $allFiles = Get-FilteredFiles -path $targetPath

    $fileCount = 0
    $skippedCount = 0
    
    foreach ($file in $allFiles) {
        # Check if file is text and not too large (max 10MB)
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
    
    # Save to file
    $content | Set-Content -Path $outputFile -Encoding UTF8
    
    Write-Host "--------------------------------------------------" -ForegroundColor Green
    Write-Host "Success! Created combined file at: $outputFile" -ForegroundColor Green
    Write-Host "Files processed: $fileCount" -ForegroundColor Green
    Write-Host "Files skipped: $skippedCount" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------" -ForegroundColor Green
}

# Show menu function
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

# Main loop
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
            
            # Handle special commands
            switch ($cmd.Name) {
                "tree" { Write-Host (Get-TreeStructure -path (Get-Location).Path) }
                "CUSTOM_TREE" { Invoke-CustomTree }
                "PATH_TREE" { Invoke-PathTree }
                "CONCAT_TREE" { Invoke-ConcatTree }
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