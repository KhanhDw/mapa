# mapa run system

1. run command env for backend: backend\myenv\Scripts\Activate.ps1
2. run docker app
3. run command docker database: docker compose up -d
4. run command fontend: npm run font
5. run command backend: npm run back

# truy cập vào docker database

```powershell
docker exec -it postgis-webmap psql -U postgres -d webmap_db
```

# cấu trúc và bảng dữ liệu đang có trong database docker

```powershell
Get-Content db\discover.sql | docker exec -i postgis-webmap psql -U postgres -d webmap_db 2>&1 | Out-File -Encoding utf8 db\discover_output.txt
```
