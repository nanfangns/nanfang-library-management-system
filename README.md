# Nanfang 图书管理系统

一个基于 `Next.js 16`、`React 19` 和 `Node 24 SQLite` 的现代图书管理系统，采用清晰的多页面结构：欢迎首页、图书列表页、导入页、新增页和编辑页各司其职。

适合作为 `Next.js 图书管理系统`、`毕业设计`、`毕设项目`、`课程设计`、`课程作业`、`Web 作业`、`数据库作业` 的参考示例。

## 功能

- 图书 CRUD：新增、编辑、删除、列表展示
- 搜索与筛选：支持按书名、作者、ISBN、分类检索，并按状态过滤
- 外部数据补全：支持通过 `Open Library` 搜索关键词或 ISBN，并导入到表单或一键入库
- 元数据扩展：支持维护出版社、语言、页数、封面地址
- 独立页面结构：首页、图书列表、导入图书、新增图书、编辑图书分开组织
- 响应式界面：桌面端和移动端都可正常使用
- 本地持久化：数据保存在 `data/library.db`

## 技术栈

- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- `Zod` 表单校验
- `node:sqlite` 本地数据库
- `Open Library API` 外部书目补全
- `lucide-react` 图标

## 环境要求

- `Node.js 24` 或更高版本
- `npm 11` 或更高版本

项目使用的是 Node 内置的 `node:sqlite`。第一次运行脚本时，终端可能会看到 SQLite 的 ExperimentalWarning，这是 Node 24 当前的正常提示，不影响使用。

## 环境变量

```bash
OPEN_LIBRARY_APP_NAME="nanfang-library-management-system"
OPEN_LIBRARY_CONTACT_EMAIL=""
```

说明：

- 这两个变量是可选的，用于给 Open Library 请求附带可识别的 `User-Agent`
- 项目当前不使用 `DATABASE_URL`
- SQLite 文件固定保存在 `data/library.db`

## 快速开始

```bash
npm install
npm run db:seed
npm run dev
```

启动后访问：

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
```

说明：

- `db:init`：初始化 SQLite 文件并输出当前图书数量
- `db:seed`：写入示例图书数据，使用 `INSERT OR IGNORE`，重复执行不会重复插入相同 ISBN

## 目录结构

```text
src/
  app/
    actions.ts      # Server Actions
    page.tsx        # 欢迎首页
    books/          # 图书列表、导入、新增、编辑页面
    globals.css     # 全局样式
  components/
    book-form.tsx   # 共享图书表单
    book-card.tsx
    external-book-card.tsx
    site-header.tsx
    delete-button.tsx
    status-badge.tsx
  lib/
    database.ts     # SQLite 数据访问层
    books.ts        # 校验与状态配置
    external-books.ts
    import-draft.ts
    types.ts        # 共享类型
scripts/
  init-db.ts
  seed-db.ts
data/
  library.db        # 本地数据库文件
```

## 验证

当前项目已经通过以下检查：

```bash
npm run db:seed
npm run lint
npm run build
```

## 页面入口

- `/`：欢迎首页
- `/books`：图书列表、搜索、筛选、删除
- `/books/import`：外部图书搜索与导入
- `/books/new`：手动录入与快速补全
- `/books/[id]/edit`：编辑现有馆藏记录

## 备注

仓库里如果看到 `_node_modules_old`，那是安装过程中残留的旧目录占位名，不参与项目运行，也已经被 `.gitignore` 忽略。
