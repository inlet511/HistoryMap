# 中国历史地图变迁程序

基于 Web 的中国历史地图变迁可视化系统：**时间 × 空间 × 事件** 三位一体。

- 横轴时间从文化期到现代，支持**非线性并列朝代**（春秋+战国、三国魏蜀吴、宋辽夏金等）
- GIS 地图标注核心势力范围，可叠加**现代行政 / 卫星 / 地形 / 无底图**四种切换
- 拖动时间轴 → 右侧纪年面板联动显示历史事件，地点与地图点位双向高亮
- 战争以攻守方箭头连线可视化
- 全数据 CRUD + 管理后台，便于后期增删改内容

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Naive UI |
| 地图 | MapLibre GL JS（矢量/栅格瓦片、4 底图切换、GeoJSON 原生） |
| 时间轴 | D3.js（非线性并列朝代条带、拖动联动） |
| 后端 | Node.js + Express + TypeScript（按功能组织 + 三层架构） |
| 数据库 | PostgreSQL + PostGIS（空间数据原生支持） |
| 认证 | JWT 短令牌(15min) + HttpOnly Cookie 刷新令牌(7d) + RBAC 四级权限 |

## 项目结构

```
.
├── client/                 # Vue 3 前端
│   ├── src/
│   │   ├── api/            # 类型化 fetch 封装 + 各模块 API
│   │   ├── components/
│   │   │   ├── MapView/    # MapContainer, BaseMapSwitcher
│   │   │   ├── Timeline/   # TimelineAxis (D3)
│   │   │   └── EventPanel/ # EventList
│   │   ├── stores/         # auth, timeline (Pinia)
│   │   ├── router/
│   │   ├── types/
│   │   └── views/          # MapView, LoginView, AdminView
│   └── ...
├── server/                 # Express + TS 后端
│   ├── src/
│   │   ├── config/         # 环境变量校验 (zod)
│   │   ├── middleware/     # auth, cors, rateLimit, errorHandler, requestId
│   │   ├── modules/        # auth, dynasties, factions, events, wars
│   │   ├── db/             # pool, migrations, seed
│   │   ├── utils/          # errors, logger, jwt, password, tokens
│   │   └── app.ts / server.ts
│   └── ...
└── data/
    ├── seed/               # 可编辑的种子数据 (JSON)
    └── raw/                # 原始 CHGIS/谭图数据 (gitignored)
```

## 环境要求

- Node.js 18+
- PostgreSQL 14+ with PostGIS extension

## 启动步骤

### 1. 数据库

```bash
# 创建数据库并启用 PostGIS
createdb china_history_map
psql -d china_history_map -c "CREATE EXTENSION postgis;"
```

### 2. 后端

```bash
cd server
cp .env.example .env      # 编辑 DATABASE_URL 与 JWT secrets
npm install
npm run migrate           # 创建表结构
npm run seed              # 导入种子数据 (32 朝代 / 14 势力 / 10 事件 / 5 战争)
npm run dev               # http://localhost:3000
```

默认管理员：`admin@example.com` / `admin123456`（生产环境务必修改）

### 3. 前端

```bash
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

## API 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/dynasties` | 公开 | 全部朝代（时间轴渲染） |
| GET | `/api/v1/dynasties/at/:year` | 公开 | 当年并列朝代 |
| POST/PUT/DELETE | `/api/v1/dynasties[/:id]` | editor+ | 朝代 CRUD |
| GET | `/api/v1/factions` | 公开 | 全部势力 |
| GET | `/api/v1/factions/at/:year` | 公开 | 当年势力 |
| GET | `/api/v1/factions/:id/geometry?year=` | 公开 | 势力范围 GeoJSON |
| POST/PUT/DELETE | `/api/v1/factions[/:id]` | editor+ | 势力 CRUD |
| GET | `/api/v1/events` | 公开 | 全部事件 |
| GET | `/api/v1/events/near/:year?range=50` | 公开 | 年份附近事件 |
| POST/PUT/DELETE | `/api/v1/events[/:id]` | editor+ | 事件 CRUD |
| GET | `/api/v1/wars` | 公开 | 全部战争 |
| GET | `/api/v1/wars/near/:year` | 公开 | 年份附近战争 |
| POST/PUT/DELETE | `/api/v1/wars[/:id]` | editor+ | 战争 CRUD |
| POST | `/api/v1/auth/register` | 公开 | 注册 |
| POST | `/api/v1/auth/login` | 公开 | 登录 |
| POST | `/api/v1/auth/refresh` | cookie | 刷新令牌 |
| POST | `/api/v1/auth/logout` | 公开 | 登出 |
| GET | `/api/v1/auth/me` | user | 当前用户 |

## RBAC 权限

| 角色 | 能力 |
|---|---|
| reader（匿名） | 浏览地图 / 时间轴 / 事件 |
| user | + 个人标注 / 收藏 |
| editor | + 增删改历史数据 |
| admin | + 用户管理 |

## 后续 TODO

- [ ] 接入 CHGIS / 谭其骧图集真实势力范围 GeoJSON（data/scripts 转换脚本）
- [ ] 战争行军路径箭头（wars.path LineString 可视化）
- [ ] 管理后台完整 CRUD 界面（含地图绘制多边形、点击选点、画连线）
- [ ] 批量 JSON/GeoJSON 导入导出
- [ ] 用户标注 / 收藏 / 分享链接
- [ ] 变更日志审计界面
- [ ] 地形 3D 地势（`map.setTerrain()` + raster-dem）
- [ ] 移动端适配
