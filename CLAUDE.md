# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

智能推广平台 (AIPP) — an AI-driven apparel/footwear promotion content generator for BigOffs. Next.js 15 App Router + React 19 + TypeScript + Tailwind. Chinese-first UI (`<html lang="zh">`).

## Commands

```bash
npm run dev      # next dev — local development
npm run build    # next build — production build (also runs type check)
npm start        # next start — serve production build
```

There is no test runner, linter, or formatter configured. Type errors surface through `next build` and `tsc --noEmit`.

## Environment

- `OPENROUTER_API_KEY` must be set in `.env.local`. All image/vision AI routes through **OpenRouter** with the OpenAI SDK (`baseURL: 'https://openrouter.ai/api/v1'`). There is no direct Anthropic/OpenAI/Google API usage — do not add new provider SDKs; reuse the shared OpenRouter client pattern.
- Models in active use: `google/gemini-2.5-flash` (analysis/JSON), `google/gemini-2.5-flash-image` (image generation), `google/gemini-3.1-flash-image-preview` (raced alongside 2.5 for try-on).

## Architecture

### Features (each is a top-level app route + matching `/api/<feature>/route.ts`)

| Route | API | Purpose |
|---|---|---|
| `/calendar` | `api/calendar` + `api/calendar/download` | HQ uploads weekly promo calendar (xlsx); regional users view/download. Server persists to `data/calendar.xlsx` + `data/calendar-meta.json`. |
| `/tryon` | `api/tryon` | Upload clothing/shoe photo → Gemini analyzes style + generates fashion photo of Western model wearing the item on a chosen background. |
| `/image-design` | `api/image-design` | Text-to-image studio with prompt, style presets, aspect ratio, text-overlay extraction. |
| `/templates` | `api/templates` | Festival/holiday/promo poster background generator. Has a hardcoded `PROMPT_MAP` of ~60 Chinese topics (节日/节气/促销/通用). Caches generated PNGs to `public/generated/<topic>.png` and returns the static URL on repeat calls — **do not regenerate if file exists**. |
| `/gallery` | — | Client-side gallery using `localStorage` (key `aipp_gallery`). |

`/` redirects to `/calendar` (`export const dynamic = 'force-dynamic'`).

### Cross-cutting modules

- **`src/lib/auth.tsx`** — Client-side hardcoded-account auth (no backend). Five test accounts defined inline with roles `hq` or `regional`. Session persisted to `sessionStorage` key `aipp_user`. `useAuth()` returns a safe SSR default when provider hasn't mounted — don't assume it throws.
- **`src/components/AuthGuard.tsx`** — Wraps protected pages; shows `LoginPage` when unauthed, spinner while `!ready`.
- **`src/lib/gallery.ts`** — `localStorage` gallery (200-item cap, base64 dataURL storage). `urlToDataUrl()` converts any URL/blob to base64 before saving so images survive refresh.
- **`src/lib/mockAI.ts`** — Despite the name, this is the **real** client-side wrapper around `/api/analyze` and `/api/tryon`. Also owns the `BACKGROUNDS` array (22 entries) and `SHOE_BACKGROUNDS` subset. Background IDs here MUST match the `BG_SCENES` keys in `api/tryon/route.ts` — adding a new background means editing both files.
- **`src/types/index.ts`** — Central types. `StyleTag` enum is the source of truth; analysis API routes also reference these exact strings in their prompts — keep in sync.

### Try-on API flow (`src/app/api/tryon/route.ts`)

Three independent LLM calls run **in parallel** via `Promise.allSettled` / `Promise.race`:
1. Gemini flash analyzes product (skippable via `skipAnalyze` when re-generating with known style).
2. Gemini flash-image (raced with 3.1-flash-image-preview) generates the on-model photo.
3. Gemini flash generates Chinese description/fitScore/occasion JSON.

`isShoes` branches the prompt: shoes get product-photo style (no model), clothing gets a Western model description. Preserve this branching when editing.

### Templates API caching

`api/templates/route.ts` generates poster backgrounds and writes them to `public/generated/<safeFilename>.png`. The `access()` check at the top is a cache hit — files are never overwritten. To regenerate, delete the PNG from `public/generated/` first. `safeFilename()` strips non-alphanumeric/non-Chinese chars.

## Conventions

- Path alias `@/*` → `./src/*` (tsconfig).
- All client components start with `'use client'`; API routes use `export const maxDuration = 120` for long-running AI calls.
- UI is Chinese (simplified). Logo is a yellow-blue text component, not an image — edit `src/components/Logo.tsx`.
- Brand colors used in UI: yellow-400 + blue-400 (BIG/OFFS logo); backgrounds default to `zinc-900` dark theme.
- No state library — React state + `sessionStorage`/`localStorage` only.

## Things not to do

- Do not add a database, auth backend, or user registration — this is a demo/prototype with hardcoded accounts on purpose.
- Do not write new Markdown files unless requested (global rule).
- Do not create new git branches unless requested (global rule).
- Do not regenerate poster PNGs that already exist in `public/generated/` — the cache is intentional.
- When adding a background to `mockAI.ts`, also add its scene description to `BG_SCENES` in `api/tryon/route.ts`, otherwise the image prompt falls back to "clean studio".
