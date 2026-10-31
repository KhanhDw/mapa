# Fixture demo panorama Hà Nội

Các dòng dưới đây là dữ liệu ví dụ để minh họa cấu trúc điểm panorama, không
được tự động nạp vào database và không đảm bảo ID chưa được sử dụng.
Tọa độ theo WGS 84 / EPSG:4326; `lng` là kinh độ, `lat` là vĩ độ.

| id | lng | lat | image_url |
|---:|---:|---:|---|
| 1 | 105.8523 | 21.0288 | `/panoramas/demo1.png` |
| 2 | 105.8517 | 21.0292 | `/panoramas/demo2.png` |
| 3 | 105.853 | 21.0295 | `/panoramas/demo3.png` |
| 4 | 105.8505 | 21.0285 | `/panoramas/demo4.png` |

Để dùng làm dữ liệu thử nghiệm, cần tạo bản ghi tương ứng trong
`public.streetview_images` theo schema của môi trường và đặt các file ảnh dưới
`PANORAMAS_DIR`. Tên file trong bảng phải khớp `image_url`; các ảnh không được
đính kèm trong fixture này. Không chèn cứng các ID nếu database đã có dữ liệu.
