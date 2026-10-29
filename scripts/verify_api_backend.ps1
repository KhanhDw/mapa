# 1. API trả về ảnh mới
$api = Invoke-RestMethod http://127.0.0.1:8000/api/streetview/points
$api.features | ForEach-Object { "$($_.properties.id): $($_.properties.image_url)" }