# SaveFlow

A social media video downloader mobile app. Paste a URL from YouTube, TikTok, Instagram, Facebook, Twitter/X, or Reddit — choose MP4 or MP3 format — and download the file.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: none for dev; `EXPO_PUBLIC_DOMAIN` is injected by the workflow

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native), expo-router v6, NativeTabs on iOS 26
- API: Express 5 + yt-dlp subprocess for video extraction
- DB: PostgreSQL + Drizzle ORM (not yet used; scaffold present)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit manually)
- `artifacts/api-server/src/routes/video.ts` — yt-dlp subprocess logic, job queue, file serving
- `artifacts/mobile/app/(tabs)/index.tsx` — Download screen (main UX)
- `artifacts/mobile/app/(tabs)/history.tsx` — History screen
- `artifacts/mobile/context/HistoryContext.tsx` — AsyncStorage-backed download history
- `artifacts/mobile/constants/colors.ts` — dark navy + violet/cyan theme tokens

## Architecture decisions

- **yt-dlp subprocess**: API server spawns yt-dlp as a child process per download job. Jobs are stored in-memory with a 1-hour TTL cleanup. Files are served over HTTP and deleted after streaming.
- **Polling over WebSockets**: Client polls `/api/video/progress/:jobId` every second using React Query `refetchInterval`. Simple and reliable without adding WebSocket complexity.
- **File delivery via Linking.openURL**: When a download completes, the app opens the file URL in the device browser. The server streams the file with `Content-Disposition: attachment`. No native file-system permissions needed.
- **Dark-only theme**: App always uses the dark navy palette (`#080B14` background, `#1E2235` cards) regardless of system setting. Clean, consistent look.
- **NativeTabs on iOS 26**: Uses `expo-router/unstable-native-tabs` with Liquid Glass detection, falls back to classic `expo-router Tabs` on older OS.

## Product

- Paste any video URL → tap Analyze → see title, uploader, duration, thumbnail
- Choose from 5 formats: MP4 1080p, 720p, 480p, MP3 320kbps, 128kbps
- Real-time circular progress indicator during download
- Download history persisted in AsyncStorage (up to 50 entries)
- Platform auto-detection (YouTube, TikTok, Instagram, Facebook, Twitter/X, Reddit)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `yt-dlp` binary is installed at `~/.nix-profile/bin/yt-dlp`. The server's `findYtDlp()` function tries multiple candidate paths — no manual PATH adjustment needed.
- Never run `pnpm dev` at workspace root. Use `restart_workflow` or the Replit workflow system.
- After changing OpenAPI spec, always run `pnpm --filter @workspace/api-spec run codegen` before updating screens.
- Orval-generated mutations wrap the body in `{ data: { ... } }` — call as `mutateAsync({ data: { url } })`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
