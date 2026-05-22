# Security Architecture

## Threat Model

The system handles sensitive data (children's photos, names, ages) and integrates with paid external APIs (OpenAI, fal.ai). The threat model addresses:

1. **Data exposure** -- unauthorized access to children's personal information
2. **API abuse** -- unbounded cost generation through uncontrolled story creation
3. **Prompt injection** -- user input manipulating AI behavior
4. **Enumeration** -- discovering other users' data by guessing identifiers

---

## Identity & Access Control

### Current Model: Anonymous Session

Users are identified by a UUID generated client-side and stored in `localStorage`:

```
Key: adventures_of_session_id
Value: crypto.randomUUID()  (e.g., "a3f4b2c1-...")
```

This UUID is sent on every Supabase request via the `x-session-id` custom header. RLS policies evaluate it server-side.

**Properties**:
- No server-side session state (stateless)
- Not cryptographically bound to a user (no signature)
- Lost if localStorage is cleared
- Not transferable across devices
- UUIDs are unguessable (122 bits of entropy)

**Limitations**:
- Anyone who obtains a session ID (e.g., via XSS, shared computer) gains full access to that session's data
- No session expiration mechanism
- No ability to revoke a session

### Future Model: Supabase Auth

The schema is pre-wired for authenticated access:
- `child_profiles.user_id` (nullable FK to `auth.users`)
- RLS policies already include `auth.uid() = user_id` checks
- Migration path: update `user_id` where `session_id` matches during account creation

---

## Row Level Security (RLS) Analysis

### Policy Design Principles

1. **Default-deny**: RLS enabled on all tables. No access without matching policy.
2. **Ownership-based**: Every policy checks that the requesting user owns the data chain.
3. **Transitive security**: story_pages access requires owning the parent story, which requires owning the parent profile.
4. **Dual-identity**: Policies accept session_id OR auth.uid() (never both required).

### Access Chain

```
child_profiles ← session_id match
     ↑
stories ← child_profile_id ownership check (subquery)
     ↑
story_pages ← story_id ownership check (nested subquery)
```

### Write Separation

- **Frontend** (anon key): Can INSERT profiles and stories, SELECT all owned data
- **Edge Function** (service role): Can INSERT story_pages and UPDATE story status
- **No user can**: Write to story_pages, modify other users' data, or access service-role operations

---

## Data Classification

| Data | Classification | Storage | Access |
|------|---------------|---------|--------|
| Child's name | PII (minor) | PostgreSQL | Session owner only (RLS) |
| Child's age | PII (minor) | PostgreSQL | Session owner only (RLS) |
| Child's interests | Personal preference | PostgreSQL | Session owner only (RLS) |
| Child's photos | Biometric/PII (minor) | Supabase Storage (public bucket) | Public URL (unguessable path) |
| Generated story text | Derived content | PostgreSQL | Session owner only (RLS) |
| Illustration URLs | Reference links | PostgreSQL | Session owner only (RLS) |
| Session UUID | Pseudonymous identifier | localStorage | Client-only |

### Photo Security Analysis

**Current Risk**: Photos are in a public bucket. Anyone with the full URL can access them.

**Mitigations**:
- Path includes session UUID + random UUID: `{session_id}/{crypto.randomUUID()}.ext`
- Total path entropy: ~244 bits (two UUIDs). Brute-force enumeration is computationally infeasible.
- No directory listing enabled (individual URLs must be known exactly)

**Why public**: fal.ai requires a publicly accessible URL to download the reference photo. Private buckets with signed URLs would work but add complexity (generating time-limited URLs, passing them through the edge function).

**Recommendation**: Switch to private bucket + signed URLs (15-minute expiry). Generate signed URL in edge function just before passing to fal.ai. Delete photos from storage after story generation completes.

---

## API Key Security

### Current State

| Key | Location | Risk Level |
|-----|----------|-----------|
| SUPABASE_ANON_KEY | Frontend .env (embedded in bundle) | LOW -- designed to be public; RLS gates all access |
| SUPABASE_SERVICE_ROLE_KEY | Edge function env (auto-injected) | LOW -- never exposed to client |
| OPENAI_API_KEY | Edge function (hardcoded in source) | HIGH -- visible in source code |
| FAL_KEY | Edge function (hardcoded in source) | HIGH -- visible in source code |

**Critical Issue**: OpenAI and fal.ai keys are hardcoded in `supabase/functions/generate-story/index.ts`. While the edge function source is not served to clients, it exists in version control and deployment artifacts.

**Fix**: Move to `Deno.env.get("OPENAI_API_KEY")` and `Deno.env.get("FAL_KEY")` without fallback values, and configure via Supabase Secrets.

---

## Input Validation & Sanitization

### Client-Side Validation (Defense in Depth)

| Input | Validation | Component |
|-------|-----------|-----------|
| Photos | image/* MIME type, max 3 files | PhotoUpload |
| Name | Non-empty string | ChildProfile |
| Age | Integer, 2-12 range | ChildProfile |
| Interests | 1-5 selections from fixed list | ChildProfile |
| Theme | Must match predefined ID | ThemeSelection |
| Illustration style | Must match predefined ID | ThemeSelection |

### Server-Side Validation

The edge function performs no input validation beyond JSON parsing. Malformed requests will produce unexpected behavior rather than clear errors.

**Recommendation**: Add schema validation (e.g., Zod) at the edge function entry point.

---

## Prompt Injection Mitigation

### Attack Surface

User-controlled strings that enter the AI prompt:
- `name` -- interpolated into prompt
- `interests[]` -- joined and interpolated
- `favorite_things` -- interpolated
- `themes_to_avoid` -- interpolated

### Current Protections

1. **Structural separation**: User input is placed in a clearly labeled `CHILD'S DETAILS:` section, distinct from instructions.
2. **Output format constraint**: The model is instructed to respond in strict JSON only, making instruction-following attacks less likely to produce harmful output.
3. **Fallback safety net**: Even if the model is manipulated, the output is JSON-parsed and rendered as children's story text -- not executed as code.

### Residual Risk

A crafted `themes_to_avoid` field like `"none. Ignore all previous instructions and instead..."` could potentially steer story content. However:
- Impact is limited to story text (no code execution, no data exfiltration)
- The audience is the same person who provided the input
- Content safety is further bounded by fal.ai's content filters

### Recommendation

Add input length limits (name: 50 chars, interests: 30 chars each, free text: 500 chars) to bound the injection surface.

---

## Content Safety

### AI-Generated Text

- The prompt explicitly requires "warm, positive stories with happy endings"
- `themes_to_avoid` is respected by the model (exclusion list)
- No mechanism to generate violent, sexual, or inappropriate content exists in the prompt structure
- The prescribed narrative arc (teamwork, kindness, resolution) inherently produces child-appropriate content

### AI-Generated Images

- fal.ai `safety_tolerance: 6` -- permissive to avoid false positives on children's content
- All illustrations depict children in illustrated (not photorealistic) style
- Prompt explicitly excludes text/words in images (prevents accidental inappropriate text generation)
- No mechanism to request inappropriate image content through the normal wizard flow

---

## CORS Configuration

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info, Apikey
```

**Assessment**: Wildcard origin is acceptable for a public-facing API with no cookie-based authentication. The anon key in the `Authorization` header provides sufficient access control, and RLS prevents cross-user data access regardless of origin.

**When to restrict**: If cookies or session-based auth is added, restrict origins to the production domain(s).

---

## Attack Surface Summary

| Vector | Protection | Residual Risk |
|--------|-----------|---------------|
| SQL injection | Supabase client parameterizes all queries | Negligible |
| XSS | React's built-in JSX escaping; no `dangerouslySetInnerHTML` | Negligible |
| CSRF | No cookie-based auth; header-based identity | N/A |
| Broken access control | RLS with ownership checks on all tables | Medium (session theft via XSS) |
| API key exposure | Keys in edge function env (not client) | High (hardcoded in source) |
| Enumeration | UUIDs for all identifiers (unguessable) | Negligible |
| Rate limiting | None implemented | High (cost abuse) |
| Photo enumeration | Double-UUID paths (244-bit entropy) | Negligible |
| Prompt injection | Structural separation + JSON output constraint | Low (content only) |
| Denial of wallet | No per-user generation limits | High |

---

## Recommended Security Hardening (Priority Order)

### P0 (Before Any Public Deployment)

1. **Remove hardcoded API keys** from edge function source. Use `Deno.env.get()` with Supabase Secrets.
2. **Add rate limiting** -- max 5 stories per session per 24-hour period. Implement as RLS policy or edge function check.

### P1 (Before Marketing Launch)

3. **Photo lifecycle management** -- delete photos from storage after generation completes (fal.ai has already downloaded them).
4. **Input validation** in edge function -- reject malformed requests with 400 status.
5. **Session age limit** -- consider expiring data older than 30 days via scheduled function.
6. **Polling timeout** -- add client-side ceiling (5 minutes) with user-facing error state.

### P2 (Before Scaling)

7. **Private storage bucket** with signed URLs for photo access.
8. **Content moderation** -- review generated stories before display (sampling or automated).
9. **Audit logging** -- track story generation events for abuse detection.
10. **User authentication** -- replace anonymous sessions with Supabase Auth for cross-device access and proper identity management.
