# 前端构建已迁移到 GitHub Actions（避免 4GB 服务器跑 vite 卡死）。
# dist 通过 docker-compose.yml 的 bind mount 直接从宿主机读取，
# 不再 COPY 进镜像（避免 BuildKit cache 命中导致新 dist 无法上线）。
# 此镜像 = nginx:alpine + 默认配置（nginx.conf 也 mount 进去）。
FROM nginx:alpine
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
