# 部署 / 代理对接说明（生产优先）

## 1) 前后端对接约定

- **后端 API 前缀**：FastAPI 路由统一挂载在 `"/api/v1"`（见 `backend/app/main.py`）。
- **前端请求基地址**：Axios `baseURL = "/api/v1"`（见 `frontend/src/services/api.ts`）。
- **结论**：前端永远走相对路径（同源），生产环境不需要让浏览器直连 `:8000`，从而避免 CORS/证书/跨域问题。

## 2) 生产环境反向代理（Nginx）

- 入口 Nginx：`nginx/nginx.conf`
  - `/` → `frontend:80`（前端静态站点 / SPA）
  - `/api/` → `backend:8000/api/`（转发到后端，最终到 `/api/v1/...`）
  - `/health` → `backend:8000/health`
- 已加固项（重点针对 **SSE 流式输出** 与 **上传**）
  - `proxy_buffering off` / `X-Accel-Buffering: no`：避免流式响应被缓存导致“卡住”
  - `proxy_read_timeout/proxy_send_timeout = 3600s`：避免长对话/慢模型超时断流
  - `client_max_body_size 50M`：支持知识库文件上传（否则可能 `413 Request Entity Too Large`）

> 说明：`frontend/nginx.conf` 也做了同样的加固，用于你直连 `frontend` 容器时（如调试端口）。

## 3) Docker Compose（生产建议只暴露 8080）

- 生产默认：`docker-compose.yml`
  - 只暴露 `nginx: 8080 -> 80` 对外
  - `postgres/backend/frontend` 不发布宿主机端口（仅容器网络可达）
- 本地调试覆盖：`docker-compose.dev.yml`
  - 发布 `postgres:5433`、`backend:8000`、`frontend:3000`（方便本机直连调试）
- 生产预留覆盖：`docker-compose.prod.yml`
  - 当前为空（保留给未来的生产专用配置扩展），部署脚本与 CI 会一起带上该文件

### 生产启动命令

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
```

### 本地调试启动命令（可选）

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## 4) 一键验收清单（建议按顺序）

1. 容器状态：`docker compose ps`
2. 健康检查（从入口 Nginx 访问）：
   - `GET http://<host>:8080/health`
   - `GET http://<host>:8080/api/v1/health`
3. 前端页面访问：`http://<host>:8080`
4. 流式对话是否“边生成边显示”（SSE）：
   - 若出现“后端已输出但前端不滚动/卡住”，优先检查 Nginx 是否仍在缓冲（本仓库已默认关闭）
5. 上传是否成功：
   - 若出现 `413`，检查入口 Nginx 的 `client_max_body_size`

## 5) 常见故障定位

- **前端 404 / API 404**
  - 确认前端请求是否为 `"/api/v1/..."`（相对路径）
  - 确认 Nginx 是否有 `location /api/ { ... }` 并指向 `backend:8000`
- **CORS 报错**
  - 绝大多数情况是浏览器在直连 `http://<host>:8000`（不建议）
  - 正确做法：统一走 `http://<host>:8080/api/...`（同源）
- **流式输出中断**
  - 检查 `proxy_read_timeout` 是否过小（仓库已设为 `3600s`）

## 6) 宿主机 Nginx（可选：80/443 → 8080）

你服务器上目前还有一个 **宿主机 Nginx 占用 80 端口**。如果你想让用户访问不带 `:8080` 的地址，可以让宿主机 Nginx 仅做一层转发：

```nginx
server {
  listen 80;
  server_name your.domain.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> 生产建议最终落到 443/TLS（可配合 certbot），避免明文传输。

## 7) 磁盘 / 镜像体积优化建议

- 后端镜像偏大通常来自 `sentence-transformers` → `torch/transformers` 依赖链（属于正常现象），如果 40G 磁盘紧张，优先从 **清理旧镜像/构建缓存** 入手：
  - 查看占用：`docker system df`
  - 清理悬挂镜像：`docker image prune -f`
  - 清理构建缓存：`docker builder prune -f`
  - 清理未使用容器：`docker container prune -f`
- 本仓库已加入 `backend/.dockerignore`、`frontend/.dockerignore`，避免把无关缓存打进构建上下文，减少构建时间与磁盘占用。

## 8) API_KEY 安全提示（生产必读）

- 目前前端会读取 `VITE_API_KEY` 并在请求中发送 `X-API-Key`，同时也支持在浏览器里设置 `localStorage.MUTIEXPERT_API_KEY`。
- 注意：任何以 `VITE_` 开头的变量都会被打进前端静态资源里，**不能当作真正的“秘密”**。如果你需要真正的鉴权/权限控制，建议引入账号体系（登录/会话/JWT）或在网关层做访问控制。
