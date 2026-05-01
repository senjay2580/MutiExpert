# 前端构建已迁移到 GitHub Actions（避免 4GB 服务器跑 vite 卡死）。
# 此 Dockerfile 期望 ./dist 目录已在 build context 中（由 CI 通过 scp 投递）。
# 服务器上构建此镜像 = 只是 COPY 静态文件 + 跑 nginx，秒级完成、几十 MB 内存。
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
