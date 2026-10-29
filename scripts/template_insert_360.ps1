# ⚠️ ĐIỀN CÁC GIÁ TRỊ:
#   $Lng, $Lat       → tọa độ GPS thực tế của ảnh mới
#   $ImageUrl        → '/panoramas/<tên-file-vừa-copy>'
#   $Heading         → hướng ban đầu của ảnh (0–360, 0 = Bắc)
#   $NextIds         → ID các ảnh muốn đi tới (xem Bước 4 để biết ID)
#   $Tx, $Ty         → tính từ Bước 1

$Lng      = 105.8545
$Lat      = 21.0302
$ImageUrl = '/panoramas/demo4.png'
$Heading  = 90
$NextIds  = @(1, 2, 3)   # ví dụ muốn đi tới ảnh 1, 2, 3
$Tx       = 887          # = width / 2
$Ty       = 620          # = height * 0.7

# Tạo mảng link_positions (mỗi next_id 1 vị trí)
$positions = @()
foreach ($id in $NextIds) {
    $positions += "{`"textureX`":$Tx,`"textureY`":$Ty}"
}
$linkJson = "[" + ($positions -join ",") + "]"
$nextSql  = "ARRAY[" + ($NextIds -join ",") + "]"

$sql = @"
INSERT INTO streetview_images (geom, image_url, heading, next_ids, link_positions)
VALUES (
    ST_SetSRID(ST_MakePoint($Lng, $Lat), 4326),
    '$ImageUrl',
    $Heading,
    $nextSql,
    '$linkJson'::jsonb
)
RETURNING id;
"@

$sql | docker exec -i postgis-webmap psql -U postgres -d webmap_db