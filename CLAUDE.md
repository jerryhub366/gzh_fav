# CLAUDE.md — GZH Fav

## Project Overview

**gzh_fav** is a Next.js web app for collecting and archiving WeChat public account (公众号, "GZH") articles. Users paste a WeChat article URL; the app scrapes the article metadata and content, stores it in Vercel Postgres, and provides a short link for later reading.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (`strict: false`) |
| Styling | Tailwind CSS 3 |
| Database | Vercel Postgres (`@vercel/postgres`) |
| Scraping | Cheerio |
| Analytics | Vercel Analytics + Speed Insights |
| Deployment | Vercel |

---

## Repository Structure

```
gzh_fav/
├── app/
│   ├── layout.tsx          # Root layout: Inter font, Vercel Analytics, SpeedInsights
│   ├── page.tsx            # Home page (client component): article list + submission form
│   ├── globals.css         # Tailwind base + CSS custom properties for dark mode
│   ├── [id]/
│   │   └── page.tsx        # Article detail page (server component)
│   └── api/
│       ├── articles/
│       │   └── route.ts    # GET /api/articles — paginated article listing
│       └── fetch/
│           └── route.ts    # POST /api/fetch — scrape URL and store article
├── lib/
│   └── db/
│       └── ensureSeq.ts    # Lazy DB migration: adds seq column + sequence
├── public/
│   └── robots.txt
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── .eslintrc.json
```

---

## Database Schema

Table: **`articles`**

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | MD5(url) first 6 hex chars — short URL identifier |
| `url` | text | Original WeChat article URL |
| `title` | text | Article title (scraped from `#activity-name`) |
| `author` | text | Account name (scraped from `#js_name`) |
| `content` | text | Cleaned HTML (scraped from `#js_content`, scripts stripped) |
| `published_at` | timestamp | Article publish date |
| `collected_at` | timestamp | Timestamp when the user collected it |
| `seq` | bigint | Auto-incrementing sequence, added lazily via `ensureSeq` |

Index: `idx_articles_seq_collected` on `(seq DESC NULLS LAST, collected_at DESC)` — used by the listing query.

### The `ensureSeq` Migration Pattern

`lib/db/ensureSeq.ts` is a lazy, idempotent migration that:
1. Creates the `articles_seq` PostgreSQL sequence if missing.
2. Adds the `seq` column to `articles` if missing.
3. Sets `seq` default to `nextval('articles_seq')`.
4. Backfills existing rows with null `seq`.
5. Advances the sequence to `MAX(seq)`.
6. Creates the index for ordering.

It is cached with a module-level `done` boolean so it only runs once per server process. It is called at the top of both API route handlers (`GET /api/articles` and `POST /api/fetch`) before any queries.

---

## API Routes

### `GET /api/articles`

Query params:
- `limit` — number of results (default 20, min 1)
- `offset` — pagination offset (default 0)

Returns:
```json
{
  "articles": [{ "id", "url", "title", "author", "publishedAt", "collectedAt", "index" }],
  "total": 123
}
```

Articles are ordered by `seq DESC NULLS LAST, collected_at DESC`. DB columns are mapped from `snake_case` to `camelCase`. The `content` column is intentionally excluded from this endpoint (bandwidth optimization).

### `POST /api/fetch`

Body: `{ "url": "<WeChat article URL>" }`

Workflow:
1. Fetches the URL with a browser-like `User-Agent`.
2. Parses HTML with Cheerio using WeChat-specific selectors.
3. Generates a 6-char hex ID: `md5(url).substring(0, 6)`.
4. Calls `ensureSeq()` then inserts into `articles`.
5. Returns `{ "shortLink": "/<id>", "article": {...} }`.

### `GET /[id]` (Article Detail Page)

Server component. Fetches `SELECT * FROM articles WHERE id = $1` and renders the scraped HTML content via `dangerouslySetInnerHTML`.

---

## Frontend Patterns

### Home Page (`app/page.tsx`)

- Marked `'use client'` — uses React hooks.
- `PAGE_SIZE = 20` articles per page.
- **Infinite scroll** via `IntersectionObserver` on a sentinel `<div>` at the bottom of the list. Triggers when the sentinel is within 200px of the viewport.
- After submitting a new URL, the list resets (`setArticles([])`) and re-fetches from offset 0 so the new article appears at the top.
- Separate loading states: `loading` (initial/submit) vs `loadingMore` (scroll pagination).

### Styling

- All styling uses Tailwind utility classes. No CSS modules.
- `globals.css` sets CSS custom properties for light/dark mode gradients.
- No component library — plain HTML elements with Tailwind.

### Server vs Client Components

- Default: server components (no directive needed).
- Add `'use client'` only when using React hooks or browser APIs.
- `app/[id]/page.tsx` is a server component (data fetched at request time).
- `app/page.tsx` is a client component (uses `useState`, `useEffect`, `useRef`, `useCallback`).

---

## Development Workflow

### Setup

Requires a Vercel Postgres database. Set the `POSTGRES_URL` (and related `POSTGRES_*`) environment variables from the Vercel project dashboard.

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

### Common Commands

```bash
npm run dev      # Local development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint (next/core-web-vitals rules)
```

### Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Vercel Postgres connection string |
| `POSTGRES_PRISMA_URL` | Prisma-compatible connection string (pooled) |
| `POSTGRES_URL_NON_POOLING` | Direct connection (for migrations) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_DATABASE` | Individual connection parts |

These are auto-populated in Vercel deployments when the Postgres integration is linked.

### Deployment

The app is deployed on Vercel. Pushing to the `main` branch triggers a production deployment. The `ensureSeq` migration runs automatically on first API call in a new deployment.

---

## Key Conventions

1. **TypeScript** — `strict: false`. Types are used but not enforced strictly. Prefer typed interfaces over `any` where practical.

2. **No ORM** — Raw SQL via Vercel's tagged template literal `sql\`...\``. Parameterized queries are handled automatically by the template tag (safe from injection).

3. **Short article IDs** — `md5(url).hex.substring(0, 6)`. Collisions are theoretically possible but rare given the expected dataset size.

4. **WeChat selectors** — The scraper relies on WeChat's specific DOM structure:
   - `#activity-name` — article title
   - `#js_name` — account/author name
   - `#js_content` — article body HTML
   - `meta[property="article:published_time"]` or `#publish_time` — publish date

5. **Content stored as HTML** — The `content` column holds cleaned HTML (scripts removed), rendered directly with `dangerouslySetInnerHTML`. Do not store or render untrusted non-WeChat URLs without additional sanitization.

6. **ESLint config** — Extends `next/core-web-vitals`. Run `npm run lint` before committing.

7. **No test suite** — There are currently no automated tests.

8. **Analytics** — Vercel Analytics and Speed Insights are included in the root layout and track all pages automatically.

---

## Invest Lab (`/lab`)

投资观点练习场：先自己答 → 三角色挑战（模型）→ 概率 + 证伪条件 + 复盘日 → 到期复盘 → 首页看校准。不做买卖建议。

- 页面：`/lab`（首页：新建卡 + 连续交作品 + 校准）、`/lab/[id]`（单卡四步）、`/lab/principles`（公开原则页）、`/lab/s/[id]?k=<shareKey>`（朋友先押注再看答案，无需登录）
- 代码：`lib/lab/principles.ts`（原则 P1–P20 + 题库，**改原则就加新版本**，旧卡指向旧版本）、`cards.ts`（单表 `lab_cards`，除筛选列外都放 `data` jsonb，懒迁移 `ensureLab()`）、`challenger.ts`（模型代理）、`markdown.ts`（导出到 vault 校准库）
- **不走 admin 登录**（2026-11-03 用户要求当独立站点用）：每个浏览器首次访问由 `GET /api/lab/me` 发一个随机身份 cookie `invest_lab_owner`，卡片按 `owner_id` 隔离，别人的卡一律 404。换设备用首页底部的同步链接 `/lab#/sync/<身份>`；agent 用 `x-lab-owner` 头即可 `POST /api/lab/cards` 建卡（`lib/lab/owner.ts`）
- 模型额度：`lab_usage` 表计数，每身份每天 30 次、全站每天 300 次（`LAB_DAILY_CHALLENGES_PER_OWNER` / `LAB_DAILY_CHALLENGES_TOTAL`），超了退回规则题库
- Blank-first 在服务端强制：三道题和初始概率没填完，`/challenge` 返回 400
- 模型：`CLOUDALPHA_API_KEY`（兼容 `OPENAI_API_KEY`），`LAB_LLM_MODEL` 默认 gpt-5.5 → `LAB_LLM_FALLBACK_MODEL` gpt-5.4-mini → 规则题库兜底。中转实际返回的模型名会变（实测请求 gpt-5.5 返回 `gpt-6.1-sol`），卡片记录的是返回值
- `review_date` 必须 `::text` 取出：pg 把 DATE 解析成本地零点，转 ISO 在东八区会每存一次倒退一天
- 本地开发连的是生产 Neon 库，测试卡用完删掉
