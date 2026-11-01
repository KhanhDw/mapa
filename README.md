# mapa run system

1. run command env for backend: backend\myenv\Scripts\Activate.ps1
2. open and run docker app
3. run command docker database: docker compose up -d
4. run command fontend: npm run dev
5. run command backend: python -m backend.main

# truy cập vào docker database

```powershell
docker exec -it postgis-webmap psql -U postgres -d webmap_db
```
