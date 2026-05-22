# Deployment

## Infrastructure Topology

```
┌────────────────────────────────────────────────────────────────┐
│                    Static Host (Vercel/Netlify/CF Pages)         │
│                                                                  │
│   dist/                                                          │
│   ├── index.html          (SPA entry, ~2KB)                     │
│   ├── assets/             (JS chunks, CSS, ~600KB gzipped)      │
│   └── (no server runtime)                                        │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                    Supabase Project                              │
│                    (fkghndufdwsikyehbglp.supabase.co)            │
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │  PostgreSQL  │  │   Storage    │  │  Edge Functions       │ │
│   │  (3 tables)  │  │   (photos)   │  │  (generate-story)    │ │
│   │  + RLS       │  │   public     │  │  Deno runtime         │ │
│   └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Build Pipeline

### Prerequisites

- Node.js >= 18
- npm (ships with Node)

### Build Commands

```bash
npm install          # Install dependencies
npm run typecheck    # TypeScript validation (tsc --noEmit)
npm run lint         # ESLint checks
npm run build        # Production build (vite build)
```

**Output**: `dist/` directory containing static assets ready for deployment.

**Build Configuration** (vite.config.ts):
- React plugin (JSX transform)
- Dep optimization excludes lucide-react (for tree-shaking)
- Target: ES2020 (supports all modern browsers)

### Environment Variables (Build-Time)

Variables prefixed with `VITE_` are embedded into the JS bundle at build time:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

These are public by design -- the anon key only grants access permitted by RLS policies.

---

## Database Deployment

Migrations are applied via the Supabase MCP tooling or dashboard SQL editor. They are idempotent (`IF NOT EXISTS` guards).

**Migration order matters**:
1. `20260518195551_create_story_tables.sql` -- Must run first (creates tables + policies)
2. `20260518203954_create_photo_storage_bucket.sql` -- Depends on storage schema existing

### Verifying Migrations

```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

---

## Edge Function Deployment

The `generate-story` function is deployed to Supabase Edge Functions (Deno runtime).

**Deployment method**: Via Supabase MCP tool (`deploy_edge_function`) or Supabase CLI.

**Configuration**:
- Slug: `generate-story`
- Entrypoint: `index.ts`
- JWT verification: **disabled** (public access for demo)
- Execution timeout: Platform default (varies by plan, typically 60-150s)

### Runtime Environment

Edge functions automatically receive these environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

### Required Secrets

These must be configured via the Supabase dashboard (Project Settings > Edge Functions > Secrets):

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | OpenAI API access for GPT-4o-mini |
| `FAL_KEY` | fal.ai API access for Flux Pro Kontext |

---

## Deployment Checklist

### First Deployment

- [ ] Supabase project created and accessible
- [ ] Migration 1 applied (tables + RLS)
- [ ] Migration 2 applied (storage bucket)
- [ ] Edge function secrets configured (OPENAI_API_KEY, FAL_KEY)
- [ ] Edge function deployed (`generate-story`)
- [ ] Frontend `.env` populated with project URL and anon key
- [ ] `npm run build` succeeds without errors
- [ ] Static assets deployed to hosting provider
- [ ] End-to-end test: create a story from landing page through reader

### Subsequent Deployments

- [ ] New migrations applied (if any)
- [ ] Edge function redeployed (if changed)
- [ ] `npm run build` succeeds
- [ ] Static assets redeployed
- [ ] Smoke test: verify story generation still works

---

## Monitoring & Observability

### Story Generation Health

```sql
-- Stories created in last 24h by status
SELECT status, COUNT(*), 
       ROUND(AVG(EXTRACT(EPOCH FROM (
         CASE WHEN status = 'complete' 
         THEN created_at + interval '1 minute'  -- approximate
         ELSE now() END
       ) - created_at)), 1) as avg_seconds
FROM stories
WHERE created_at > now() - interval '24 hours'
GROUP BY status;
```

### Failure Detection

```sql
-- Stories stuck in 'generating' for >5 minutes (likely edge function crash)
SELECT id, child_profile_id, created_at
FROM stories
WHERE status = 'generating'
  AND created_at < now() - interval '5 minutes';
```

### Edge Function Logs

Available in Supabase Dashboard: **Edge Functions > generate-story > Logs**

Key log messages to watch:
- `"AI generation unavailable, using fallback:"` -- OpenAI failure
- `"fal.ai error for page N, using fallback:"` -- Individual illustration failure
- `"fal.ai generation timed out"` -- Queue congestion

### Storage Growth

```sql
-- Approximate storage usage (photos per session)
SELECT session_id, COUNT(*) as photo_count
FROM storage.objects
WHERE bucket_id = 'child-photos'
GROUP BY session_id
ORDER BY photo_count DESC
LIMIT 20;
```

---

## Rollback Procedures

| Component | Rollback Method | Data Impact |
|-----------|-----------------|-------------|
| Frontend | Redeploy previous build artifact | None (stateless) |
| Edge Function | Redeploy previous index.ts version | In-flight generations may fail |
| Database (additive migration) | No rollback needed (additive is safe) | None |
| Database (destructive migration) | Write new forward migration to reverse | Potential data loss |

**Critical**: Supabase does not support `DOWN` migrations. All schema changes must be forward-only. If a migration causes issues, write a new migration that reverses the change.

---

## Environment Promotion Strategy

**Current**: Single environment (dev/production combined).

**Recommended** (when moving to production):

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Local     │───▶│   Staging   │───▶│  Production │
│             │    │             │    │             │
│ Supabase A  │    │ Supabase B  │    │ Supabase C  │
│ .env.local  │    │ .env.staging│    │ .env.prod   │
└─────────────┘    └─────────────┘    └─────────────┘
```

Each environment gets its own Supabase project, ensuring:
- Migration testing without production risk
- Separate API keys and quotas
- Independent edge function versions
- Isolated storage buckets

---

## Cost Estimation (Production)

| Resource | Free Tier | Pro Tier ($25/mo) | Scaling Factor |
|----------|-----------|-------------------|----------------|
| Database | 500MB, 2 projects | 8GB, unlimited | ~50 bytes/story |
| Storage | 1GB | 100GB | ~9MB/story (3 photos) |
| Edge Functions | 500K invocations | 2M invocations | 1 per story |
| Bandwidth | 2GB | 250GB | ~10MB per story read |
| OpenAI | N/A | ~$0.003/story | Linear with volume |
| fal.ai | N/A | ~$0.20/story | Linear with volume |

**Break-even**: Pro tier covers infrastructure for ~11K stories/month. External API costs ($0.20/story) dominate at scale.
