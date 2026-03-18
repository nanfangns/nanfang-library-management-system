# MySQL 使用说明

这个项目已经支持 `DATABASE_DRIVER="mysql"`，适合连接本地 MySQL 8 或远程自建 MySQL 实例。

## 1. 准备数据库

先准备一个可访问的 MySQL 8 数据库，例如：

- 本机 MySQL
- 宝塔 / 面板里的 MySQL
- 云厂商托管 MySQL
- 学校服务器上的 MySQL

本次适配不包含旧数据自动迁移脚本。如果你之前已经在 SQLite 或 Turso 里有数据，需要自行迁移。

## 2. 配置环境变量

至少配置下面这些：

```bash
DATABASE_DRIVER="mysql"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_USER="root"
MYSQL_PASSWORD=""
MYSQL_DATABASE="nanfang_library"
MYSQL_SSL="false"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OPEN_LIBRARY_APP_NAME="nanfang-library-management-system"
OPEN_LIBRARY_CONTACT_EMAIL=""
```

说明：

- `MYSQL_PORT` 默认是 `3306`
- `MYSQL_PASSWORD` 可以为空字符串
- `MYSQL_SSL` 支持 `true / false`、`1 / 0`、`yes / no`、`on / off`
- 开启 `MYSQL_SSL="true"` 后会使用 TLS 连接

## 3. 初始化表结构与示例数据

项目会在首次连接时自动检查并创建 `books` 表，也会自动补齐历史缺失字段。

你可以直接运行：

```bash
npm run db:init
npm run db:seed
```

如果你想清空后重置示例数据：

```bash
npm run db:reset
```

## 4. 启动项目

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

## 5. 已兼容的能力

- 图书列表查询与状态筛选
- 新增、编辑、删除图书
- ISBN 重复校验
- 示例数据初始化与重置
- 外部图书导入页的本地查重

也就是说，页面层和 Server Actions 不需要因为切换到 MySQL 而改单独逻辑。

## 6. 常见问题

### 为什么还保留 SQLite 和 Turso？

因为三种模式适合不同场景：

- `SQLite` 适合本地快速开发
- `Turso` 适合配合 Vercel 公开演示
- `MySQL` 适合接已有数据库环境

### 这个项目支持 MariaDB 吗？

这次适配目标是 MySQL 8，MariaDB 没有作为正式兼容目标验证。

### 如果数据库里还没有表怎么办？

不需要手动建表。项目会在首次连接时自动建表并补齐必要索引与字段。
