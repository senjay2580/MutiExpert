# 本地开发环境启动

一键启动 MutiExpert 本地开发环境（前端 + 后端），连接生产数据库。

## 执行步骤

1. 用 PowerShell 新窗口启动后端（端口 8888，避开 Hyper-V 保留端口）：

```bash
powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd d:\Desktop\MutiExpert\backend; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8888'"
```

2. 用 PowerShell 新窗口启动前端（端口 5173）：

```bash
powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd d:\Desktop\MutiExpert\frontend; npm run dev'"
```

3. 启动完成后告知用户：
   - 后端: http://localhost:8888
   - 前端: http://localhost:5173
   - 前端 `/api` 请求自动代理到后端 8888 端口
   - 数据库连接生产环境 120.76.158.129:5432

## 注意事项

- Windows Hyper-V 保留了 7961-8060 端口范围，所以后端不能用 8000
- 后端 .env 在 `backend/.env`，DATABASE_URL 指向生产数据库
- vite.config.ts 的 proxy target 已改为 localhost:8888
- 用完后记得关闭 PowerShell 窗口停止服务
