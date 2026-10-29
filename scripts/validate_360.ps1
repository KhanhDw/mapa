Add-Type -AssemblyName System.Drawing

# Cho phép người dùng nhập đường dẫn file hoặc URL trực tiếp
$inputPath = Read-Host "Nhập đường dẫn file ảnh hoặc URL ảnh của bạn"

# Xử lý nếu người dùng nhập URL
if ($inputPath -match "^https?://") {
    "⏳ Đang tải ảnh từ URL..."
    $tempFile = [System.IO.Path]::GetTempFileName() + ".png"
    try {
        Invoke-WebRequest -Uri $inputPath -OutFile $tempFile -UseBasicParsing
        $path = $tempFile
    } catch {
        Write-Error "❌ Không thể tải ảnh từ URL: $_"
        exit
    }
} else {
    # Xử lý đường dẫn file thông thường (loại bỏ dấu ngoặc kép thừa nếu có)
    $path = $inputPath.Trim('"').Trim("'")
}

# Kiểm tra file có tồn tại không trước khi đọc
if (-not (Test-Path $path)) {
    Write-Error "❌ Không tìm thấy file ảnh tại đường dẫn: $path"
    exit
}

try {
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $path))
    $w = $img.Width
    $h = $img.Height
    $ratio = [math]::Round($w / $h, 3)
    $img.Dispose()

    Write-Host ""
    "----------------------------------------"
    "File   : $inputPath"
    "Size   : ${w} x ${h}"
    "Ratio  : $ratio"
    "Valid  : $(if ([math]::Abs($ratio - 2.0) -lt 0.05) { '✅ YES (equirectangular)' } else { '❌ NO (ratio phải ~2.0)' })"
    "Sharp  : $(if ($w -ge 4096) { '✅ Đủ nét' } elseif ($w -ge 2048) { '⚠️ Tạm được, có thể nhòe khi zoom' } else { '❌ Quá nhỏ, chắc chắn nhòe' })"

    # 💡 GHI NHỚ để dùng cho Bước 3:
    "Mũi tên gợi ý: textureX=$([int]($w/2)), textureY=$([int]($h*0.7))"
    "----------------------------------------"
} catch {
    Write-Error "❌ Lỗi khi đọc kích thước ảnh: $_"
} finally {
    # Dọn dẹp file tạm nếu tải từ URL
    if ($inputPath -match "^https?://" -and (Test-Path $tempFile)) {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}