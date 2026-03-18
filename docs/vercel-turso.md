# Vercel + Turso 部署说明

这个项目已经完成了 `SQLite 本地开发 + Turso 线上部署` 的双库适配，适合本地继续使用文件数据库开发，同时把线上版本部署到 Vercel。

## 1. 准备 Turso 数据库

先在 Turso 创建一个数据库，并拿到这两项配置：

- `DATABASE_URL`
- `DATABASE_AUTH_TOKEN`

示例：

```bash
DATABASE_URL="libsql://your-db-name-your-org.turso.io"
DATABASE_AUTH_TOKEN="..."
```

## 2. 在 Vercel 配置环境变量

至少配置下面这些：

```bash
NEXT_PUBLIC_APP_URL="https://your-project.vercel.app"
DATABASE_DRIVER="turso"
DATABASE_URL="libsql://your-db-name-your-org.turso.io"
DATABASE_AUTH_TOKEN="..."
OPEN_LIBRARY_APP_NAME="nanfang-library-management-system"
OPEN_LIBRARY_CONTACT_EMAIL="your-email@example.com"
```

如果你只是本地开发，可以继续用默认配置：

```bash
DATABASE_DRIVER="sqlite"
```

## 3. 首次部署后写入演示数据

在本地 PowerShell 里临时切到 Turso 配置，然后执行重置脚本：

```powershell
$env:DATABASE_DRIVER="turso"
$env:DATABASE_URL="libsql://your-db-name-your-org.turso.io"
$env:DATABASE_AUTH_TOKEN="your-token"
npm run db:reset
```

这个脚本会：

- 清空现有图书数据
- 重新写入示例馆藏

适合首次部署和后续“演示环境数据重置”。

## 4. Vercel 部署建议

- 建议直接从 GitHub 仓库导入到 Vercel
- 部署完成后，把 GitHub 仓库的 `homepage` 更新成你的 Vercel 域名
- 如果你要公开演示，可以在 README 里明确标注“演示数据会定期重置”

## 5. 本地与线上的区别

- 本地：默认使用 `data/library.db`
- 线上：使用 `Turso`
- 页面、Server Actions、校验逻辑和表结构保持一致

## 6. 常见问题

### 为什么本地还保留 SQLite？

因为它最适合本地开发、课程作业和毕设演示，开箱即跑，迁移成本也低。

### 为什么线上不继续用本地 SQLite 文件？

因为 Vercel 不适合长期持久化本地文件写入，换成 Turso 以后更稳定，也更适合公开演示。
