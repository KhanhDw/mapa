# BƯỚC 1: Validate + tự tính textureX/Y
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path ".\data\panoramas\demo4.png"))
$w = $img.Width; $h = $img.Height; $img.Dispose()
"Size: ${w}x${h}, Ratio: $([math]::Round($w/$h,3)), textureX: $([int]($w/2)), textureY: $([int]($h*0.7))"

# BƯỚC 2: Verify backend serve ảnh
curl.exe -sI http://127.0.0.1:8000/panoramas/demo4.png

# BƯỚC 3 + 4 + 5: INSERT + link + verify (điền $Tx, $Ty từ bước 1)
$Lng = 105.8505; $Lat = 21.0285; $Heading = 180; $NextIds = @(1,2,3)
$Tx = 887; $Ty = 620   # ← thay bằng giá trị từ Bước 1

$positions = @()
foreach ($id in $NextIds) { $positions += "{`"textureX`":$Tx,`"textureY`":$Ty}" }
$linkJson = "[" + ($positions -join ",") + "]"
$nextSql  = "ARRAY[" + ($NextIds -join ",") + "]"

@"
INSERT INTO streetview_images (geom, image_url, heading, next_ids, link_positions)
VALUES (ST_SetSRID(ST_MakePoint($Lng, $Lat), 4326), '/panoramas/demo4.png', $Heading, $nextSql, '$linkJson'::jsonb)
RETURNING id;
"@ | docker exec -i postgis-webmap psql -U postgres -d webmap_db

# Link 2 chiều (dùng ID mới từ output trên, giả sử = 4)
$NewId = 4
@"
UPDATE streetview_images
SET next_ids = array_append(COALESCE(next_ids, ARRAY[]::integer[]), $NewId),
    link_positions = COALESCE(link_positions, '[]'::jsonb) || '[{"textureX":$Tx,"textureY":$Ty}]'::jsonb
WHERE id IN (1, 2, 3) AND NOT ($NewId = ANY(COALESCE(next_ids, ARRAY[]::integer[])));
"@ | docker exec -i postgis-webmap psql -U postgres -d webmap_db

# Verify
docker exec -it postgis-webmap psql -U postgres -d webmap_db -P pager=off -c "SELECT id, image_url, next_ids FROM streetview_images ORDER BY id;"