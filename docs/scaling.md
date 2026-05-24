# Scaling Analysis

## Current System Capacity

The architecture is designed for **demo/early-stage usage** (single-digit concurrent users). This document identifies where bottlenecks emerge at each growth stage and prescribes specific interventions.

---

## Resource Consumption Per Story

| Resource | Amount | Notes |
|----------|--------|-------|
| Database rows | 10 | 1 profile + 1 story + 8 pages |
| Database storage | ~5 KB | Text content + metadata |
| Object storage | 3-9 MB | 1-3 uploaded photos |
| Edge function time | 30-120s | Dominated by fal.ai queue + rate limit waits |
| OpenAI tokens | ~5K | ~2K prompt + ~3K completion (1-2 API calls) |
| fal.ai images | 8 | One per page, 4:3 JPEG |
| Client HTTP requests | ~15-25 | Uploads + inserts + polling |

---

## Bottleneck Analysis

### 1. Edge Function Execution Duration

**Constraint**: Each story generation occupies one Deno isolate for 30-120 seconds.

**Current behavior**: Supabase spins up new isolates for concurrent requests (horizontal scaling). No shared state between invocations.

**Failure point**: At ~50 concurrent generations, platform-level concurrency limits may throttle. The exact limit depends on the Supabase plan.

**Signal**: Edge function requests start returning 503 or queue indefinitely.

### 2. fal.ai Queue Depth

**Constraint**: 10 parallel image generation requests per story. fal.ai uses a shared GPU queue.

**At 10 concurrent users**: 100 simultaneous fal.ai requests. Queue wait times increase from seconds to minutes.

**At 100 concurrent users**: 1000 simultaneous requests. fal.ai may rate-limit the API key. Generation time could exceed the 2-minute polling timeout, triggering fallbacks.

**Signal**: Increasing frequency of "fal.ai generation timed out" in edge function logs.

### 3. Polling Load

**Current**: Each active generation polls every 2 seconds for 15-60 seconds = 8-30 requests.

**At 1000 concurrent generations**: 500 SELECT queries/second against Postgres.

**Assessment**: PostgreSQL handles this trivially (primary key lookups). This is not a real bottleneck but is architecturally inelegant.

### 4. Storage Growth

**Rate**: ~6 MB per story (average 2 photos x 3 MB each).

| Stories | Storage | Monthly Cost (Pro) |
|---------|---------|-------------------|
| 1,000 | 6 GB | Included |
| 10,000 | 60 GB | Included (100 GB limit) |
| 50,000 | 300 GB | Overage charges |
| 100,000 | 600 GB | Significant ($$$) |

**Critical**: Photos are never deleted. Without lifecycle management, storage grows monotonically.

### 5. fal.ai Image URL Expiration

**Hidden issue**: fal.ai CDN URLs expire after ~7 days. Stories created more than a week ago will have broken illustration links.

**Impact**: Silent degradation. Users returning to re-read their story see broken images.

**Fix**: Download fal.ai images to Supabase Storage immediately after generation. Store permanent URLs in `story_pages.illustration_url`.

---

## Scaling Stages

### Stage 1: MVP (Current) -- 0 to 100 stories/month

**No changes needed.** System operates well within all limits.

**Focus**: Product validation, not infrastructure.

### Stage 2: Early Traction -- 100 to 1,000 stories/month

**Interventions**:

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Move API keys to Supabase Secrets | 30 min | Security |
| P0 | Add per-session rate limit (5/day) | 2 hours | Cost control |
| P1 | Download fal.ai images to storage | 4 hours | Fix image expiry |
| P1 | Delete source photos after generation | 2 hours | Storage growth |
| P2 | Client-side image compression (max 1024px) | 2 hours | Upload speed + storage |

### Stage 3: Growth -- 1,000 to 10,000 stories/month

**Interventions**:

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Switch polling to Supabase Realtime | 1 day | Eliminate polling load |
| P0 | Add exponential backoff to fal.ai polling | 2 hours | Reduce fal.ai quota usage |
| P1 | Implement generation queue (max 20 concurrent) | 3 days | Prevent fal.ai rate limiting |
| P1 | Add CDN in front of illustration storage | 1 day | Reduce bandwidth costs |
| P2 | Monitor + alert on generation failures | 1 day | Operational visibility |
| P2 | Add story archival (>90 days → cold storage) | 2 days | Database size management |

### Stage 4: Scale -- 10,000 to 100,000 stories/month

**Interventions**:

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Split edge function: orchestrator + image workers | 1 week | Independent scaling, better timeout handling |
| P0 | fal.ai webhook callbacks (instead of polling) | 2 days | Eliminate timeout issues |
| P1 | Database read replicas | Supabase plan | Story reading performance |
| P1 | Story page lazy loading (fetch current + next only) | 4 hours | Reduce query payload |
| P2 | Multi-region deployment | 2 weeks | Latency for international users |
| P2 | Pre-generate popular theme variations | 1 week | Instant delivery for common combos |

---

## Cost Projections

### Per-Story Cost Breakdown

| Component | Cost | % of Total |
|-----------|------|-----------|
| OpenAI GPT-4o (1-2 calls) | $0.07 | 15% |
| fal.ai (8 images) | $0.40 | 83% |
| Supabase compute | ~$0.001 | 0.5% |
| Storage (3 photos) | ~$0.001 | 0.5% |
| **Total** | **~$0.47** | 100% |

### Monthly Projections

| Volume | AI Cost | Infrastructure | Total | Per-Story Avg |
|--------|---------|---------------|-------|---------------|
| 100/mo | $20 | $25 (Pro) | $45 | $0.45 |
| 1,000/mo | $205 | $25 | $230 | $0.23 |
| 10,000/mo | $2,050 | $75 | $2,125 | $0.21 |
| 100,000/mo | $20,500 | $400 | $20,900 | $0.21 |

### Cost Optimization Levers

| Strategy | Savings | Tradeoff |
|----------|---------|----------|
| Reduce to 7 illustrations (cover + 6 key moments) | 30% fal.ai cost | Less visual richness |
| Use cheaper fal.ai model for background-only pages | 20% fal.ai cost | Slightly lower quality |
| Cache identical theme backgrounds | 5-10% fal.ai cost | Limited personalization per page |
| Batch illustration generation during off-peak | 10-15% fal.ai cost | Longer generation time |
| Switch to SDXL (self-hosted) | 80% image cost | GPU infrastructure required |

---

## Performance Optimization Opportunities

### Client-Side

| Optimization | Current | Proposed | Impact |
|-------------|---------|----------|--------|
| Story reader images | All 10 loaded at once | Lazy load current + next page | 90% less initial bandwidth |
| Photo upload | Full resolution | Compress to max 1024px client-side | 60% faster uploads |
| Bundle splitting | Single chunk (~600KB) | Route-based code splitting | 50% faster initial load |
| Preconnect | None | DNS prefetch for Supabase + fal.ai CDN | 100-300ms saved |

### Server-Side

| Optimization | Current | Proposed | Impact |
|-------------|---------|----------|--------|
| Text generation | Wait for full response | Stream JSON tokens | Could display title immediately |
| Illustration generation | Wait for all 8 | Progressive delivery (show pages as ready) | Better perceived performance |
| fal.ai queue | Poll every 2s | Use webhooks | Eliminate polling overhead |
| Database writes | Insert all 8 pages atomically | Insert pages as they complete | Earlier partial reads possible |

### Database

| Optimization | Current | Proposed | When |
|-------------|---------|----------|------|
| Story status polling | PK lookup (already optimal) | Realtime subscription | >1000 concurrent |
| Story pages fetch | `WHERE story_id = $1 ORDER BY page_number` | Already indexed | N/A (already good) |
| RLS subqueries | Nested subqueries for ownership | Denormalize session_id onto stories | >10K stories/month |
| Old data | All data retained forever | Partition by created_at, archive >90 days | >100K total stories |

---

## Architectural Evolution Path

```
Current:   Monolithic Edge Function + Polling
                    │
                    ▼ (at 1K stories/mo)
Phase 2:   Monolithic Edge Function + Realtime Subscriptions
                    │
                    ▼ (at 10K stories/mo)
Phase 3:   Orchestrator Function + Worker Functions + Queue
           ├── text-generation-worker
           ├── image-generation-worker (webhook-based)
           └── completion-notifier (updates DB + notifies client)
                    │
                    ▼ (at 100K stories/mo)
Phase 4:   Dedicated Services
           ├── Story API (rate limiting, auth, orchestration)
           ├── AI Text Service (model routing, caching, A/B testing)
           ├── AI Image Service (queue management, retry, model selection)
           └── Storage Service (lifecycle, CDN, optimization)
```

Each phase is triggered by concrete signals (error rates, cost thresholds, latency increases) rather than speculative pre-optimization.

---

## Resilience Under Load

### What Happens When fal.ai is Slow (>2 min per image)

- Images that exceed the 2-minute timeout get Pexels fallback URLs
- Other images in the same story may still succeed (per-page fallback)
- Story is still marked `complete` with mixed illustration sources
- User experience: some pages have personalized art, some have stock photos

### What Happens When fal.ai is Down

- All 10 images immediately fall back to Pexels
- Story text still generated by OpenAI
- Total generation time drops to ~10 seconds (no image queue wait)
- User gets a complete story faster, just without personalized illustrations

### What Happens When OpenAI is Down

- Hardcoded fallback story used (themed, personalized with child's name)
- fal.ai illustrations still attempted (using fallback story's illustration prompts)
- User gets a generic-but-themed story with personalized illustrations

### What Happens When Both are Down

- Fallback story + Pexels images
- Story generation completes in <5 seconds
- User gets a readable 8-page story (just not personalized beyond name)
- This is the worst-case scenario and it still delivers a usable product
