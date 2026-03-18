# Nanfang 图书管理系统

> 一个适合作为 `图书管理系统`、`Next.js 后台项目`、`毕业设计`、`毕设`、`课程设计`、`课程作业` 参考的中文开源项目。

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-Local-0f6cbd?style=flat-square)](https://www.sqlite.org/)
[![Turso](https://img.shields.io/badge/Turso-Vercel%20Ready-7c3aed?style=flat-square)](https://turso.tech/)
[![License](https://img.shields.io/badge/License-MIT-16a34a?style=flat-square)](./LICENSE)

仓库已经完成 `SQLite 本地开发 + Turso 线上部署` 的双库适配，适合本地快速运行，也适合后续挂到 Vercel 做公开演示。

快速入口：

- [项目截图](#页面预览)
- [本地启动](#本地启动)
- [部署说明](./docs/vercel-turso.md)
- [Vercel 一键部署](https://vercel.com/new/clone?repository-url=https://github.com/nanfangns/nanfang-library-management-system)

## 项目简介

这是一个围绕馆藏录入、资料维护、检索筛选和外部书目补全构建的现代化图书管理系统。

它不是那种把所有功能堆在一个页面里的练手 Demo，而是拆成了更清晰的业务页面：

- `/` 欢迎首页
- `/books` 图书列表页
- `/books/import` 外部图书导入页
- `/books/new` 新增图书页
- `/books/[id]/edit` 编辑图书页

如果你想找的是：

- `Next.js 图书管理系统`
- `React 后台管理系统`
- `毕业设计 / 毕设项目`
- `课程设计 / 课程作业`
- `CRUD 管理系统源码`

这个仓库会比普通“表单 + 表格”的示例更完整一些。

## 页面预览

### 首页与导航

![首页预览](./public/previews/home-hero.png)

### 图书列表与搜索筛选

![图书列表预览](./public/previews/catalog-overview.png)

### 外部导入与补全入口

![导入图书预览](./public/previews/import-workflow.png)

### 录入流程与业务表单

![新增图书预览](./public/previews/new-book-workflow.png)

### 项目动图

![项目动图预览](./public/previews/flow-demo.gif)

## 功能亮点

- 清晰页面结构：首页、列表、导入、新增、编辑各归各位
- 本地响应快：默认直接使用 SQLite 文件数据库
- 外部书目补全：接入 Open Library 搜索与预填
- 现代界面：偏 Google 风格的明亮配色与卡片布局
- 搜索体验优化：局部加载反馈，不再整页闪烁
- 移动端可用：导航和主内容已经针对小屏做过调整
- 适合二开：类型、校验、数据访问和页面职责相对清晰

## 适合谁用

- 想做 `毕业设计 / 毕设` 的同学
- 想交 `课程设计 / 课程作业 / Web 作业 / 数据库作业` 的同学
- 想找一个完整一点的 `Next.js CRUD 后台项目` 做参考的人
- 想做图书馆、馆藏、书目管理类原型系统的人

## 技术架构

- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- `Zod` 表单校验
- `SQLite` 本地开发数据库
- `Turso` 线上演示数据库
- `Open Library API` 外部图书补全
- `Server Actions` 提交与跳转

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化示例数据

```bash
npm run db:seed
```

### 3. 启动开发服务器

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:init
npm run db:seed
npm run db:reset
npm run assets:preview
```

## 部署说明

如果你要做公开演示，推荐使用：

- Vercel 托管前端与 Next.js 服务
- Turso 承载线上数据库

详细步骤见：

- [Vercel + Turso 部署说明](./docs/vercel-turso.md)

## 环境变量

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DATABASE_DRIVER="sqlite"
DATABASE_URL=""
DATABASE_AUTH_TOKEN=""
OPEN_LIBRARY_APP_NAME="nanfang-library-management-system"
OPEN_LIBRARY_CONTACT_EMAIL=""
```

说明：

- 本地默认使用 SQLite，所以 `DATABASE_DRIVER` 保持 `sqlite` 即可
- 部署到 Vercel 时把 `DATABASE_DRIVER` 改成 `turso`
- `DATABASE_URL` 与 `DATABASE_AUTH_TOKEN` 仅在 Turso 模式下必填

## 常见问题

### 1. 为什么本地还是 SQLite？

因为它最适合本地开发、课程作业和毕设答辩演示，开箱即跑，迁移成本也低。

### 2. 为什么线上要换 Turso？

因为 Vercel 不适合长期持久化本地 SQLite 文件，把线上切到 Turso 会更稳。

### 3. 这个项目适合拿去做毕设吗？

适合。它已经覆盖了：

- 多页面业务结构
- 表单校验
- 本地数据库 CRUD
- 外部 API 接入
- 响应式界面
- 可部署方案

如果你还要继续扩展，很适合往这些方向加：

- 登录与权限
- 借阅流程
- 图书详情页
- 统计看板
- 批量导入导出

### 4. 为什么 README 顶部没有直接挂一个公开演示域名？

仓库已经完成了部署适配，但公开演示域名需要你自己的 Vercel/Turso 账号授权后再发布。部署文档已经写好，接上就能用。
