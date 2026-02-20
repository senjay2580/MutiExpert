# 服务器环境信息

> 最后更新: 2026-02-20

## 基础信息

| 项目 | 值 |
|------|-----|
| **IP** | 120.76.158.129 |
| **入口** | http://120.76.158.129:8080 |
| **OS** | CentOS 7 (Core) |
| **Kernel** | 3.10.0-1160.119.1.el7.x86_64 |
| **CPU** | 2 核 Intel Xeon Platinum 8269CY @ 2.50GHz |
| **内存** | 3.7G 总计 / 1.9G 已用 / 1.4G 可用 |
| **磁盘** | 40G 总计 / 27G 已用 (73%) / 11G 可用 |

## Docker 环境

| 项目 | 版本 |
|------|------|
| Docker | 26.1.4 |
| Docker Compose | v2.27.1 |

## 容器状态

| 容器 | 状态 | 端口映射 | 镜像 | 大小 |
|------|------|----------|------|------|
| mutiexpert-nginx | Running | `8080→80` | nginx:alpine | 62MB |
| mutiexpert-web | Running | `3000→80` | mutiexpert-frontend | 63MB |
| mutiexpert-api | Running | `8000→8000` | mutiexpert-backend | **8.3GB** |
| mutiexpert-db | Running (healthy) | `5433→5432` | pgvector/pgvector:pg16 | 438MB |
| Myn8n | Running | `5678→5678` | n8nio/n8n:2.1.1 | 1.08GB |
| mysql | Running | `3307→3306` | mysql:8.0 | 783MB |
| nanobot | Exited | - | nanobot:latest | 759MB |

## 端口占用

| 端口 | 服务 | 说明 |
|------|------|------|
| 80 | 宿主机 Nginx | 非 Docker，系统自带 |
| 3000 | mutiexpert-web | 前端直连（dev 模式暴露） |
| 3307 | mysql | MySQL 8.0 |
| 5433 | mutiexpert-db | PostgreSQL 16 + pgvector |
| 5678 | Myn8n | n8n 自动化平台 |
| 8000 | mutiexpert-api | 后端直连（dev 模式暴露） |
| 8080 | mutiexpert-nginx | **生产入口** |

## Docker 存储

### Volumes
| Volume | 用途 |
|--------|------|
| mutiexpert_pgdata | PostgreSQL 数据 |
| mutiexpert_uploads | 上传文件 |
| nanobot_data | Nanobot 数据 |
| 2 个匿名 volume | 可能废弃，待清理 |

### Networks
| Network | Driver |
|---------|--------|
| mutiexpert_default | bridge |
| 1panel-network | bridge |

## 注意事项

1. **磁盘 73%** — 较紧张，建议定期 `docker image prune` 清理旧镜像
2. **后端镜像 8.3GB** — 异常偏大（正常 < 500MB），需优化 Dockerfile（清理 pip 缓存、多阶段构建）
3. **dev 端口暴露** — 3000/8000/5433 直接暴露，生产环境应只保留 8080
4. **宿主机 Nginx (80)** — 与 Docker 容器 Nginx 独立，注意避免冲突
5. **CentOS 7 已 EOL** — 官方已停止维护，长期建议迁移至 AlmaLinux / Rocky Linux
6. **匿名 volume** — 2 个无名 volume 可能是废弃的，确认后可 `docker volume prune` 清理
