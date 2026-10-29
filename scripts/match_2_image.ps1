# ⚠️ THAY $NewId = ID vừa insert ở Bước 3
$NewId = 4

# Tính link_position của ảnh MỚI (để đặt mũi tên đúng vị trí trên ảnh đích)
$Tx = 887      # width mới / 2
$Ty = 620      # height mới * 0.7

$sql = @"
UPDATE streetview_images
SET
    next_ids = array_append(COALESCE(next_ids, ARRAY[]::integer[]), $NewId),
    link_positions = COALESCE(link_positions, '[]'::jsonb) || '[{"textureX":$Tx,"textureY":$Ty}]'::jsonb
WHERE id IN (1, 2, 3)
  AND NOT ($NewId = ANY(COALESCE(next_ids, ARRAY[]::integer[])));
"@

$sql | docker exec -i postgis-webmap psql -U postgres -d webmap_db