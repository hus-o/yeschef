# YesChef — Hackathon Execution Plan

> **Solo dev + AI assistant | Two hackathons | Feb 8–12, 2026**

---

## 🎯 Submission Targets

| Hackathon                                     | Deadline           | Prize Pool | Key Requirements                                                     |
| --------------------------------------------- | ------------------ | ---------- | -------------------------------------------------------------------- |
| **Gemini 3**                                  | Feb 9, 5PM PT      | $100K      | Gemini 3 API, public repo, 3-min video, publicly accessible          |
| **RevenueCat Shipyard** (Eitan Bernath brief) | Feb 12, 11:59PM PT | $165K      | RevenueCat SDK, TestFlight/APK link, 2-3 min video, written proposal |

## ⚠️ Critical Blockers & Decisions

### ✅ DECIDED: Android-Only (No Apple Developer Account)

**No $99 Apple Dev Account.** Going Android-only.

**Distribution: Google Play Internal Testing ($25 one-time)**

- Sign up at https://play.google.com/console ($25 one-time fee)
- Create app listing → set up internal testing track
- Upload APK from EAS Build → get shareable link
- Up to 100 testers via Gmail address
- RevenueCat sandbox purchasing works on internal testing
- **This link replaces TestFlight for Shipyard submission**

### ✅ DECIDED: Two-Frontend Strategy

Same backend, two frontends optimized for each hackathon:

**1. React Web App → Gemini 3 (Feb 9)**

- Fast to build — no native modules, no build pipeline, no dev accounts
- LiveKit web SDK (`@livekit/components-react`) is simpler than RN
- Deploy as **Render Static Site** → publicly accessible URL
- Gemini 3 rules say "publicly accessible" — a web URL is perfect
- Demo mode only (no auth, no paywall) — judges just open the link
- **Build this FIRST** — submit Gemini 3 without waiting on Android

**2. Expo Android App → Shipyard (Feb 12)**

- Full mobile experience with RevenueCat paywall + Supabase auth
- Google Play Internal Testing ($25) for distribution link
- 3 extra days after Gemini 3 deadline to build and polish
- Reuses same API service layer, same backend, same LiveKit rooms

**Zero backend changes between the two.** Backend is client-agnostic.

### 🚀 Deployment: Everything on Render

All services on one platform — simpler, free tier for everything.

| Component          | Render Service Type   | Cost      |
| ------------------ | --------------------- | --------- |
| FastAPI backend    | **Web Service**       | Free tier |
| LiveKit Agent      | **Background Worker** | Free tier |
| React web frontend | **Static Site**       | Free tier |

> ⚠️ Free tier spins down after 15 min inactivity (~30s cold start). Fine for hackathon demos.

### LiveKit Cloud Account — NOT SET UP YET

**Action:** Sign up at https://cloud.livekit.io (free tier: 50 participant-minutes/month). Get `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`. Do this in Phase 0.

---

## 🏗️ Architecture (Final)

```
┌──────────────────────────────────────────────────────┐
│              PRIMARY FRONTEND (Android)                │
│         Expo SDK 54 + Dev Build (Android Only)        │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │ Paste   │→ │ Recipe   │→ │ Cook Screen        │   │
│  │ URL     │  │ Detail   │  │ (LiveKit RN SDK)   │   │
│  └─────────┘  └──────────┘  └────────────────────┘   │
│       │            │              │                    │
│  RevenueCat    Supabase      LiveKit Room             │
│  Paywall       Auth          (audio/video)            │
└───────┬────────────┬──────────────┬───────────────────┘
        │            │              │
   RevenueCat    Supabase      LiveKit Cloud
   Dashboard     (Auth+DB)     ┌────┴────────┐
                               │ LiveKit     │
                               │ Agent       │
                               │ (Python)    │
                               │   ↕         │
                               │ Gemini 2.5  │
                               │ Flash Live  │
                               └─────────────┘
        │
┌───────┴──────────────────────────────────────────────┐
│                 FASTAPI BACKEND (Render)               │
│                                                       │
│  POST /extract  →  Supadata/Firecrawl → Gemini 3     │
│  GET /recipes   →  Supabase query                     │
│  GET /recipe/:id → Supabase query                     │
│  POST /session/summary → Gemini 3 analysis            │
│  GET /health                                          │
└───────────────────────────────────────────────────────┘
```

### Fallback Frontend (Web — Gemini 3 only, if needed)

```
┌──────────────────────────────────────────────────────┐
│               REACT WEB APP (Vercel)                  │
│         React + @livekit/components-react             │
│                                                       │
│  Same screens, same API calls, same LiveKit rooms     │
│  Deploy to Vercel → publicly accessible URL           │
│  NO native modules, NO build pipeline, NO dev account │
└───────────────────────────────────────────────────────┘
```

### Dual-Model Strategy

| Model                                           | Use Case                                           | Why                            |
| ----------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| `gemini-3-flash-preview`                        | Recipe extraction, session summary, text reasoning | Gemini 3 hackathon requirement |
| `gemini-2.5-flash-native-audio-preview-12-2025` | Live cooking sessions via LiveKit Agent            | Only model supporting Live API |

---

## 📅 Phase Plan

### Repo Strategy & Tagging

**Single monorepo.** Use git tags to create immutable snapshots for each submission.

#### Why This Is Safe

Both hackathons' rules explicitly state:

> "Once the Submission Period has ended, you may not make any changes or alterations to your Submission, but you may continue to update the Project in your Devpost portfolio."

- **Submission** = the Devpost form (title, description, video link, demo URL, repo link). This locks at deadline.
- **Project** = the code repo and deployed app. You **can** keep updating this.
- Git tags provide a verifiable snapshot of exactly what was submitted at each deadline.

#### Tagging Workflow

```bash
# ── GEMINI 3 (Feb 9, before 5PM PT) ──
# 1. Ensure everything is committed and deployed
git add -A && git commit -m "Gemini 3 submission — YesChef web app"

# 2. Create annotated tag with metadata
git tag -a gemini3-submission -m "Gemini 3 hackathon submission - Feb 9, 2026
Includes: FastAPI backend, LiveKit Agent, React web frontend
Deploy: All on Render (API + Agent + Static Site)
Demo URL: https://yeschef.onrender.com"

# 3. Push tag
git push origin main --tags

# 4. Submit on Devpost (links to this tagged commit)
# 5. Continue working toward Shipyard...


# ── SHIPYARD (Feb 12, before 11:59PM PT) ──
# 1. Ensure everything is committed and deployed
git add -A && git commit -m "Shipyard submission — YesChef Android app"

# 2. Create annotated tag
git tag -a shipyard-submission -m "RevenueCat Shipyard submission - Feb 12, 2026
Includes: Everything from Gemini 3 + Expo Android app + Auth + RevenueCat
New: yeschef-app/ directory, Supabase auth, RevenueCat paywall
Distribution: Google Play Internal Testing link"

# 3. Push tag
git push origin main --tags
```

#### What Each Tag Captures

| Tag                   | Directories Used                                   | Not Yet Created                  |
| --------------------- | -------------------------------------------------- | -------------------------------- |
| `gemini3-submission`  | `yeschef-backend/`, `yeschef-web/`                 | `yeschef-app/` doesn't exist yet |
| `shipyard-submission` | `yeschef-backend/`, `yeschef-web/`, `yeschef-app/` | — (complete)                     |

#### Key Safety Rules

1. **Never force-push or move tags** — they must remain immutable proof of what was submitted.
2. **Gemini 3 submission won't include `yeschef-app/`** — the directory simply doesn't exist at that point, so there's zero overlap risk.
3. **Post-Gemini 3 backend changes** (e.g., adding auth middleware for Shipyard) won't affect the Gemini 3 submission because Devpost locks the submission form. The demo URL may evolve but that's explicitly allowed.
4. **To verify a tag later:** `git show gemini3-submission` shows the exact commit and timestamp.
5. **Judges clone/view the latest code**, but the tag proves what existed at submission time if ever questioned.

---

## PHASE 0 — Project Setup (2 hours)

**Goal:** Accounts ready, React web project created, backend env updated.

> ⚡ The web frontend is FIRST priority (Gemini 3 deadline is tomorrow).
> Android/Expo setup deferred to Phase 6 (after Gemini 3 submission).

### 0.1 Accounts & Keys (Do NOW — while reading the rest)

- [ ] **LiveKit Cloud** → https://cloud.livekit.io (free tier)
  - Get `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- [ ] Verify Supabase project is live at `zewckixbtiqxnvdgsfvd.supabase.co`
- [ ] **Google Play Console** → https://play.google.com/console ($25 one-time)
  - Can do this AFTER Gemini 3 submission — needed for Shipyard only
- [ ] **RevenueCat** — verify dashboard configured (you have API key `sk_GboF...`)
  - Also can defer to post-Gemini 3 — needed for Shipyard only

### 0.2 Create React Web Project (Gemini 3 Frontend)

> 🔧 **Skill: `frontend-design`** — Use for polished, distinctive UI

```bash
npm create vite@latest yeschef-web -- --template react-ts
cd yeschef-web
npm install
```

### 0.3 Install Web Dependencies

```bash
# LiveKit (web SDK — no native modules!)
npm install @livekit/components-react livekit-client

# Routing
npm install react-router-dom

# State
npm install zustand

# UI
npm install lucide-react
```

### 0.4 Web Project Structure

```
yeschef-web/
├── src/
│   ├── main.tsx
│   ├── App.tsx              # Router
│   ├── pages/
│   │   ├── Home.tsx          # Paste URL, recent recipes
│   │   ├── Recipe.tsx        # Recipe detail + ingredients
│   │   └── Cook.tsx          # LiveKit web cook session
│   ├── components/
│   │   ├── RecipeCard.tsx
│   │   ├── StepCard.tsx
│   │   ├── IngredientList.tsx
│   │   └── AudioIndicator.tsx
│   ├── services/
│   │   └── api.ts            # FastAPI client (shared logic with mobile)
│   ├── store/
│   │   └── recipeStore.ts
│   └── config.ts             # API_URL, demo mode
├── index.html
├── package.json
└── vite.config.ts
```

### 0.6 Backend Environment

Add to `yeschef-backend/.env`:

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
```

Add to `yeschef-backend/requirements.txt`:

```
livekit-agents>=1.0
livekit-plugins-google>=1.0
livekit-api>=1.0
```

---

## PHASE 1 — Backend Core (3–4 hours)

**Goal:** Solid recipe extraction + API endpoints using Gemini 3.

> 🔧 **Skill: `fastapi-templates`** — Use for project structure, error handling, dependency injection patterns
> 🔧 **Skill: `supabase-postgres-best-practices`** — Use for schema design and query optimization
> 🔧 **Skill: `supadata`** — Use for Supadata API integration (YouTube/TikTok/Instagram transcripts)

### 1.1 Fix Database Schema

Update `schema.sql`:

```sql
-- Recipes table (enhanced)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT NOT NULL,
  source_platform TEXT, -- 'youtube', 'tiktok', 'instagram', 'web'
  thumbnail_url TEXT,
  servings TEXT,
  prep_time TEXT,
  cook_time TEXT,
  total_time TEXT,
  difficulty TEXT, -- 'easy', 'medium', 'hard'
  cuisine TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  tags TEXT[],
  confidence FLOAT, -- AI extraction confidence 0-1
  raw_transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  source_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error TEXT,
  recipe_ids UUID[], -- array of recipe IDs created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cook sessions table (NEW)
CREATE TABLE IF NOT EXISTS cook_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  recipe_id UUID REFERENCES recipes(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  transcript JSONB, -- [{role, content, timestamp}]
  summary TEXT, -- AI-generated summary
  rating INT, -- 1-5
  user_notes TEXT,
  completed_steps INT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cook_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Recipes: readable by all (demo mode), writable by owner
CREATE POLICY "Recipes are viewable by everyone" ON recipes FOR SELECT USING (true);
CREATE POLICY "Users can insert own recipes" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own recipes" ON recipes FOR UPDATE USING (auth.uid() = user_id);

-- Jobs: owner only
CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create jobs" ON jobs FOR INSERT WITH CHECK (true);

-- Sessions: owner only
CREATE POLICY "Users can view own sessions" ON cook_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create sessions" ON cook_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 1.2 Fix Ingest Router

In `routers/ingest.py`:

- Change model from `gemini-2.5-flash-preview-04-17` → `gemini-3-flash-preview`
- Add TikTok + Instagram support via Supadata (already supports it)
- Return multiple recipes if source contains multiple
- Add proper error handling and validation
- Add `GET /recipes` endpoint (list user's recipes)
- Add `GET /recipes/{id}` endpoint (single recipe detail)
- Fix `user_id` to accept optional auth header

### 1.3 Add Recipe List/Detail Endpoints

New endpoints:

```python
@router.get("/recipes")
async def list_recipes(user_id: Optional[str] = None):
    """List recipes, optionally filtered by user."""

@router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str):
    """Get single recipe by ID."""

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll job status."""
```

### 1.4 Add Session Summary Endpoint

```python
@router.post("/sessions/{session_id}/summary")
async def generate_summary(session_id: str):
    """Use Gemini 3 to analyze cook session transcript."""
    # Fetch transcript from Supabase
    # Send to gemini-3-flash-preview for analysis
    # Return summary + rating suggestion
```

### 1.5 Test Backend Manually

- Test URL extraction with YouTube, TikTok, Instagram, web recipe links
- Verify structured recipe data quality
- Verify Supabase storage

---

## PHASE 2 — LiveKit Agent (3–4 hours)

**Goal:** LiveKit Agent that bridges Gemini 2.5 Flash Live API for cooking sessions.

> 🔧 **Skill: `documentation-lookup`** — Use for LiveKit Agents Python SDK docs

### 2.1 Create LiveKit Agent

New file: `yeschef-backend/livekit_agent.py`

```python
"""
YesChef LiveKit Agent
Connects to Gemini 2.5 Flash Live API for real-time cooking assistance.
Runs as a separate process from the FastAPI server.
"""
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins.google import beta as google_beta

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Get recipe context from room metadata
    recipe_data = ctx.room.metadata  # JSON string of recipe

    model = google_beta.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-12-2025",
        voice="Aoede",  # warm, friendly voice
        system_instructions=f"""You are YesChef, a warm and encouraging cooking assistant.
You are guiding the user through this recipe step by step:

{recipe_data}

Guidelines:
- Be conversational, warm, and encouraging
- Guide one step at a time, don't rush ahead
- When the user says "next" or "done", move to the next step
- Offer tips and substitution suggestions when relevant
- If the user asks you to look at something, ask them to turn on their camera
- Keep responses concise for audio (2-3 sentences max)
- Use the phrase "Yes, Chef!" when the user completes a step
- Track which step the user is on
- Alert about timing (e.g., "set a timer for 5 minutes")
""",
    )

    agent = MultimodalAgent(model=model)
    agent.start(ctx.room)

    # Initial greeting
    session = await agent.aio.sessions[0]
    await session.conversation.item.create(
        text=f"Hey! I'm YesChef, your cooking assistant. I see you're making {recipe_data.get('title', 'something delicious')}. Ready to get started? Just say 'let's go' when you're ready!",
        role="assistant",
    )
    await session.response.create()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

### 2.2 Add Token Generation Endpoint

In FastAPI backend, add endpoint for frontend to get LiveKit room tokens:

```python
# routers/live.py (rewrite)
from livekit.api import AccessToken, VideoGrants

@router.post("/live/token")
async def create_live_token(recipe_id: str, user_id: str = "demo-user"):
    """Generate a LiveKit room token for a cook session."""
    room_name = f"cook-{recipe_id}-{uuid4().hex[:8]}"

    # Fetch recipe from Supabase for room metadata
    recipe = await get_recipe(recipe_id)

    # Create LiveKit room with recipe as metadata
    # (LiveKit Agent will read this metadata)

    # Generate participant token
    token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(user_id)
    token.with_name("Chef")
    token.with_grants(VideoGrants(
        room_join=True,
        room=room_name,
    ))

    return {
        "token": token.to_jwt(),
        "room_name": room_name,
        "livekit_url": LIVEKIT_URL,
    }
```

### 2.3 Run Agent Locally for Testing

```bash
cd yeschef-backend
python livekit_agent.py dev
```

Test with LiveKit's playground: https://agents-playground.livekit.io

### 2.4 Deploy Agent

Options:

- **Same Render instance** as FastAPI (separate process via Procfile)
- **LiveKit Cloud Hosted Agent** (if available on free tier)
- **Separate Render worker**

Procfile for Render:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
worker: python livekit_agent.py start
```

---

## PHASE 3 — React Web Frontend (4–5 hours)

**Goal:** Working web app: paste URL → recipe detail → live cook. For Gemini 3 submission.

> 🔧 **Skill: `frontend-design`** — Use for polished, distinctive UI design
> This is a standard React + Vite app. No native modules. No build pipeline complexity.

### 3.1 Pages (React Router)

```tsx
// App.tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/recipe/:id" element={<Recipe />} />
  <Route path="/cook/:id" element={<Cook />} />
</Routes>
```

### 3.2 Home Page (pages/Home.tsx)

**Priority: HIGH — First thing Gemini 3 judges see**

- Large, inviting input field for URL paste
- "Paste a recipe link from YouTube, TikTok, Instagram, or any website"
- Submit → POST /extract → poll job → recipe card appears
- Pre-loaded demo recipes below (judges don't have to wait)
- Warm color palette (oranges, creams, earthy tones)
- Clean, modern design — not generic AI aesthetic

### 3.3 Recipe Detail Page (pages/Recipe.tsx)

- Hero image/thumbnail from source
- Title, cook time, servings, difficulty badge
- Ingredients list with checkboxes
- Steps list with numbering
- Big "Start Cooking" CTA button → navigates to /cook/:id
- No auth gate, no paywall (demo mode for Gemini 3)

### 3.4 Cook Page (pages/Cook.tsx) — THE MONEY SCREEN

**Priority: HIGHEST — This is what makes YesChef special**

> 🔧 **Skill: `frontend-design`** — Use for the cook screen UI specifically

```tsx
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
} from "@livekit/components-react";

export default function Cook() {
  const { token, url } = useLiveKitToken(recipeId);

  return (
    <LiveKitRoom serverUrl={url} token={token} connect={true}>
      <RoomAudioRenderer />
      <CookUI recipe={recipe} />
    </LiveKitRoom>
  );
}
```

Web cook UI layout:

```
┌─────────────────────────────────────────────┐
│  ← Back to Recipe              🎤 Mute     │
├─────────────────────────────────────────────┤
│                                             │
│   ┌───────────────────────────────────┐     │
│   │  Step 3 of 8                       │     │
│   │                                    │     │
│   │  Dice the onions into small cubes  │     │
│   │  (about ¼ inch)                    │     │
│   │                                    │     │
│   │  ⏱️ Timer: --                      │     │
│   └───────────────────────────────────┘     │
│                                             │
│   ◀ Prev         Step          Next ▶       │
│                                             │
├─────────────────────────────────────────────┤
│  🔴 LIVE · YesChef is listening             │
│                                             │
│  "Great job on the garlic! Now let's        │
│   dice those onions..."                     │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━ 🔊               │
│  Audio visualizer / connection status       │
├─────────────────────────────────────────────┤
│  [ End Session ]                            │
└─────────────────────────────────────────────┘
```

Key features:

- Browser microphone access (simple `getUserMedia` — no native modules)
- Mic mute/unmute toggle
- Current step card (synced with AI guidance via data channel)
- Live transcript / AI status area
- Audio visualizer for agent speech
- "End Session" button
- Responsive — works on desktop and mobile browsers

### 3.5 State Management (Zustand)

```
store/
  recipeStore.ts     # Recipes, jobs, extraction state
```

### 3.6 API Service Layer

```typescript
// services/api.ts
const API_URL = import.meta.env.VITE_API_URL || 'https://yeschef-api.onrender.com';

export const api = {
  extractRecipe: (url: string) => fetch(`${API_URL}/extract`, { method: 'POST', ... }),
  getJob: (jobId: string) => fetch(`${API_URL}/jobs/${jobId}`),
  getRecipes: () => fetch(`${API_URL}/recipes`),
  getRecipe: (id: string) => fetch(`${API_URL}/recipes/${id}`),
  getLiveToken: (recipeId: string) => fetch(`${API_URL}/live/token`, { method: 'POST', ... }),
  getDemoRecipes: () => fetch(`${API_URL}/demo/recipes`),
};
```

---

## PHASE 4 — Web Integration & Demo Mode (2–3 hours)

**Goal:** Web app connected end-to-end. Demo mode for Gemini 3 judges.

### 4.1 End-to-End Flow (Web)

Test the complete flow in browser:

1. Open web app → see demo recipes + paste input
2. Paste YouTube recipe URL → backend extracts → recipe card appears
3. Click recipe → detail page with ingredients and steps
4. Click "Start Cooking" → browser mic permission → LiveKit connects → AI greets user
5. Talk through recipe steps → AI guides via voice
6. End session

### 4.2 Demo Mode (Web is inherently demo mode)

The web app IS the demo — no auth, no paywall:

```typescript
// config.ts
export const API_URL =
  import.meta.env.VITE_API_URL || "https://yeschef-api.onrender.com";
export const DEMO_MODE = true; // Web app is always demo mode
```

Pre-loaded sample recipes so judges see immediate value without waiting for extraction.

### 4.3 Backend Demo Endpoint

```python
@router.get("/demo/recipes")
async def get_demo_recipes():
    """Return pre-extracted sample recipes for demo mode."""
    return SAMPLE_RECIPES  # 2-3 hardcoded high-quality examples
```

### 4.4 Deploy Web to Render Static Site

```bash
cd yeschef-web
npm run build  # → dist/ folder
```

Render Static Site config:

- **Build Command:** `cd yeschef-web && npm install && npm run build`
- **Publish Directory:** `yeschef-web/dist`
- **Environment:** `VITE_API_URL=https://yeschef-api.onrender.com`

Result: `https://yeschef.onrender.com` — publicly accessible URL for judges.

### 4.5 Error Handling

- Network failure graceful handling + retry
- LiveKit disconnection recovery
- Empty/invalid URL feedback
- Extraction failure messaging
- Loading states / skeletons everywhere
- Browser mic permission denied → helpful message

---

## PHASE 5 — Gemini 3 Submission (2–3 hours)

**⏰ DEADLINE: Feb 9, 5PM PT**

### 5.1 Deploy (All on Render)

- [ ] **Render Web Service:** FastAPI backend (`uvicorn main:app`)
- [ ] **Render Background Worker:** LiveKit Agent (`python livekit_agent.py start`)
- [ ] **Render Static Site:** React web app (`yeschef-web/dist`)
- [ ] Verify all three services are running on Render dashboard
- [ ] Test publicly accessible URL: `https://yeschef.onrender.com`
- [ ] Wake up the free-tier services before recording video (hit /health)

### 5.2 Record 3-Minute Demo Video

**Structure (40% technical, 30% innovation, 20% impact, 10% presentation):**

| Timestamp | Content                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| 0:00-0:20 | Hook: "What if your browser could be your sous chef?" Show cooking problem                                     |
| 0:20-0:50 | Demo: Paste a TikTok recipe link → extraction in action → recipe card appears (web app)                        |
| 0:50-1:20 | Demo: Show recipe detail, ingredient checklist                                                                 |
| 1:20-2:20 | Demo: Live cook session — talk to AI in browser, get guided through steps                                      |
| 2:20-2:40 | Technical: Architecture diagram, Gemini 3 for extraction + Gemini 2.5 for Live, LiveKit, all on Render         |
| 2:40-3:00 | Impact: "From saved recipe to dinner made" — anyone can cook with AI guidance. Mobile app coming for Shipyard. |

### 5.3 Submission Checklist

- [ ] Public GitHub repo (clean README with setup instructions)
- [ ] Demo video (≤3 min, uploaded to YouTube or similar)
- [ ] Devpost submission with description
- [ ] Verify demo mode works (judges can access without login)
- [ ] `git tag gemini3-submission && git push --tags`

### 5.4 README Template

```markdown
# YesChef 🧑‍🍳 — AI Cooking Assistant

Paste any recipe link. Get guided through cooking it with AI voice assistance.

## Gemini 3 API Usage

- **gemini-3-flash-preview**: Recipe extraction from URLs, session summaries
- **gemini-2.5-flash-native-audio-preview**: Real-time voice cooking guidance via Live API

## Tech Stack

- **Frontend**: React (Vite) — web app, publicly accessible
- **Backend**: FastAPI (Python)
- **AI**: Gemini 3 Flash + Gemini 2.5 Flash Live API
- **Realtime**: LiveKit Agents
- **Data**: Supabase (auth + database)
- **Ingestion**: Supadata (social video transcripts) + Firecrawl (web scraping)
- **Monetization**: RevenueCat

## Setup

[Instructions here]
```

---

## 🏁 GEMINI 3 DEADLINE — Feb 9, 5PM PT

## ↓ Continue to Shipyard phases below ↓

---

## PHASE 6 — Android App + Auth + RevenueCat (5–6 hours)

**Goal:** Create Expo Android app with auth + RevenueCat paywall. Reuse all backend work.

> 🔧 **Skill: `vercel-react-native-skills`** — Expo project setup patterns
> 🔧 **Skill: `supabase-postgres-best-practices`** — Auth integration patterns
> 🔧 **Skill: `documentation-lookup`** — RevenueCat + LiveKit RN SDK docs

### 6.0 Create Expo Project + First Android Build

```bash
npx create-expo-app@latest yeschef-app --template blank-typescript
cd yeschef-app

# Navigation
npx expo install expo-router expo-linking expo-constants expo-status-bar

# LiveKit (React Native)
npx expo install @livekit/react-native @livekit/react-native-webrtc

# RevenueCat
npx expo install react-native-purchases react-native-purchases-ui

# Supabase
npm install @supabase/supabase-js

# UI & Utilities
npx expo install expo-clipboard expo-haptics expo-av
npm install zustand react-native-safe-area-context
```

Create `eas.json`:

```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {}
  }
}
```

Update `app.json` plugins:

```json
{
  "expo": {
    "plugins": [
      "@livekit/react-native-webrtc",
      ["expo-build-properties", { "android": { "minSdkVersion": 24 } }]
    ]
  }
}
```

Kick off first build (runs in background while you code):

```bash
npx eas-cli@latest build --profile development --platform android
```

### 6.0b App Structure (Expo Router)

```
app/
  _layout.tsx          # Root layout with providers
  index.tsx            # Home: paste URL, recent recipes
  recipe/
    [id].tsx           # Recipe detail + ingredient check
  cook/
    [id].tsx           # Live cook screen (LiveKit RN)
  profile.tsx          # Settings, past sessions
  auth/
    login.tsx          # Supabase email auth
    signup.tsx
```

### 6.0c Port Web Screens to React Native

The screens are the same logic, just RN components instead of HTML:

- `Home` → TextInput instead of `<input>`, FlatList instead of mapped divs
- `Recipe` → ScrollView, same API calls
- `Cook` → `<LiveKitRoom>` from `@livekit/react-native` instead of web SDK
- Reuse `services/api.ts` logic (fetch calls are identical)

### 6.1 Supabase Auth

```typescript
// services/supabase.ts
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Screens:

- `app/auth/login.tsx` — Email + password
- `app/auth/signup.tsx` — Email + password + name
- Auth state in Zustand store, persisted

### 6.2 RevenueCat Integration

```typescript
// services/revenuecat.ts
import Purchases from "react-native-purchases";

export async function initRevenueCat() {
  Purchases.configure({
    apiKey: REVENUECAT_API_KEY, // Android key
  });
}

export async function checkSubscription(): Promise<boolean> {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active["pro"] !== undefined;
}
```

### 6.3 Paywall Gate

Before cook screen:

```typescript
import RevenueCatUI from "react-native-purchases-ui";

async function handleStartCooking(recipeId: string) {
  // 1. Check auth
  if (!user) {
    router.push("/auth/login");
    return;
  }

  // 2. Check subscription
  const isPro = await checkSubscription();
  if (!isPro) {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: "pro",
    });
    if (result === "not_purchased") return;
  }

  // 3. Proceed to cook
  router.push(`/cook/${recipeId}`);
}
```

### 6.4 RevenueCat + Google Play Setup

- [ ] Create in-app subscription product in Google Play Console
- [ ] Link Google Play product to RevenueCat
- [ ] Create "YesChef Pro" entitlement in RevenueCat
- [ ] Set up offering with monthly subscription
- [ ] Test paywall + sandbox purchase via internal testing track
- [ ] Verify entitlement unlocks cook screen

---

## PHASE 7 — Session Summary & Polish (4–6 hours)

**Goal:** Complete the "from saved recipe to dinner made" loop. Polish everything.

> 🔧 **Skill: `frontend-design`** — Use for final UI polish
> 🔧 **Skill: `vercel-react-native-skills`** — Use for performance optimization

### 7.1 Session Summary Screen

After cook session ends:

- Send transcript to `POST /sessions/{id}/summary`
- Backend uses `gemini-3-flash-preview` to generate:
  - Summary of the session
  - What went well / what could improve
  - Suggested rating (1-5 stars)
- User can add their own notes
- User can adjust rating
- Save to Supabase

### 7.2 Profile / History Screen

- List past cook sessions
- Session detail with summary, rating, notes
- Link back to original recipe

### 7.3 UI Polish

- Smooth transitions/animations
- Haptic feedback on interactions
- Proper loading skeletons
- Error state illustrations
- Empty state designs
- App icon and splash screen

### 7.4 Edge Cases & Robustness

- Offline recipe viewing (cache with AsyncStorage)
- LiveKit reconnection handling
- Background audio for cook session (phone locked)
- Timer notifications

---

## PHASE 8 — Shipyard Submission (2–3 hours)

**⏰ DEADLINE: Feb 12, 11:59PM PT**

### 8.1 Eitan Bernath Brief — "From Saved Recipe to Dinner Made"

Your app literally does this:

1. Save a recipe (paste link → extract → save)
2. Get guided through making dinner (live cook session)
3. Complete with summary of how it went

### 8.2 Written Proposal (Required)

```markdown
## YesChef — From Saved Recipe to Dinner Made

### Problem

People save hundreds of recipe links but rarely cook them.
The gap between "that looks good" and "dinner is served" is huge.

### Solution

YesChef bridges that gap with AI-powered live cooking guidance:

1. Paste any recipe link (YouTube, TikTok, Instagram, web)
2. AI extracts structured recipe data instantly
3. Check your ingredients
4. Start a live cook session with AI voice guidance
5. Get a session summary with tips for next time

### RevenueCat Integration

- Free tier: Extract and save unlimited recipes
- Pro tier ($X/month): Live cook sessions with AI guidance
- RevenueCat paywall presented before cook session
- Subscription management via RevenueCat dashboard

### Technical Architecture

[Include architecture diagram]

### Eitan Bernath Brief Alignment

"From saved recipe to dinner made" — this IS our app.
Every feature serves the journey from discovery to completion.
```

### 8.3 Demo Video (2-3 min)

Focus on the user journey + RevenueCat integration:

1. Paste link → recipe saved
2. Hit paywall → subscribe
3. Cook with AI → complete meal
4. Session summary

### 8.4 Build & Distribution (Android — Google Play Internal Testing)

- [ ] Build release APK: `eas build --profile preview --platform android`
- [ ] Upload APK/AAB to Google Play Console → Internal Testing track
- [ ] Add judges' Gmail addresses as testers (or use open link)
- [ ] Get shareable internal testing link
- [ ] Verify RevenueCat sandbox purchase works via internal testing

### 8.5 Submission Checklist

- [ ] Devpost submission
- [ ] Demo video (2-3 min)
- [ ] Written proposal
- [ ] **Google Play Internal Testing link** (replaces TestFlight)
- [ ] Public repo link
- [ ] `git tag shipyard-submission && git push --tags`

---

## 🧰 Skill Usage Reference

| Skill                                  | When to Use                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ |
| **`fastapi-templates`**                | Phase 1 — Backend structure, error handling, dependency injection        |
| **`supabase-postgres-best-practices`** | Phase 1 — Schema design, RLS policies, query patterns                    |
| **`supadata`**                         | Phase 1 — Supadata API for YouTube/TikTok/Instagram transcripts          |
| **`frontend-design`**                  | Phase 3, 7 — UI design for web + mobile cook screen, home screen, polish |
| **`vercel-react-native-skills`**       | Phase 6, 7 — Expo patterns, RN best practices, performance               |
| **`documentation-lookup`**             | Phase 2, 3, 6 — LiveKit web SDK, LiveKit RN SDK, RevenueCat, Expo docs   |

---

## ⏱️ Time Estimates (Solo + AI)

### 🔥 GEMINI 3 TRACK (Feb 8–9)

| Phase   | What                             | Hours | Cumulative |
| ------- | -------------------------------- | ----- | ---------- |
| Phase 0 | Setup (accounts + web project)   | 1.5h  | 1.5h       |
| Phase 1 | Backend Core (extraction + APIs) | 3-4h  | 5.5h       |
| Phase 2 | LiveKit Agent                    | 3-4h  | 9.5h       |
| Phase 3 | React Web Frontend               | 4-5h  | 14.5h      |
| Phase 4 | Web Integration + Deploy         | 2-3h  | 17.5h      |
| Phase 5 | **Gemini 3 Submission**          | 2h    | **19.5h**  |

### 📱 SHIPYARD TRACK (Feb 9–12)

| Phase   | What                            | Hours | Cumulative |
| ------- | ------------------------------- | ----- | ---------- |
| Phase 6 | Android App + Auth + RevenueCat | 5-6h  | 25.5h      |
| Phase 7 | Session Summary + Polish        | 4-6h  | 31.5h      |
| Phase 8 | **Shipyard Submission**         | 2-3h  | **34.5h**  |

**Total: ~35 hours across 5 days**

### Priority Cuts (If Running Out of Time for Gemini 3)

1. ❌ Cut session summary (defer to Shipyard)
2. ❌ Cut ingredient checklist (defer to Shipyard)
3. ❌ Cut auth entirely (demo mode only)
4. ❌ Cut camera toggle in cook session (audio only)
5. ✅ KEEP: URL paste → recipe extraction → live cook with voice

### Priority Cuts (If Running Out of Time for Shipyard)

1. ❌ Cut session summary
2. ❌ Cut profile/history screen
3. ❌ Cut polish/animations
4. ✅ KEEP: Auth + RevenueCat paywall (REQUIRED)
5. ✅ KEEP: Everything from Gemini 3 submission

---

## 📁 Final Project Structure

```
yeschef/
├── yeschef-backend/          # FastAPI + LiveKit Agent (Render)
│   ├── main.py               # FastAPI app
│   ├── livekit_agent.py      # LiveKit Agent (separate process)
│   ├── dependencies.py       # Env vars, clients
│   ├── schemas.py            # Pydantic models
│   ├── schema.sql            # Supabase migration
│   ├── requirements.txt
│   ├── Procfile              # Render: web + worker
│   ├── .env
│   └── routers/
│       ├── ingest.py         # POST /extract, GET /recipes, GET /recipe/:id
│       ├── live.py           # POST /live/token
│       └── sessions.py       # POST /sessions/:id/summary
│
├── yeschef-web/              # React web frontend → Gemini 3 (Render Static)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx           # React Router
│       ├── pages/
│       │   ├── Home.tsx      # Paste URL, demo recipes
│       │   ├── Recipe.tsx    # Recipe detail + ingredients
│       │   └── Cook.tsx      # LiveKit web cook session
│       ├── components/
│       │   ├── RecipeCard.tsx
│       │   ├── StepCard.tsx
│       │   ├── IngredientList.tsx
│       │   └── AudioIndicator.tsx
│       ├── services/
│       │   └── api.ts        # FastAPI client
│       ├── store/
│       │   └── recipeStore.ts
│       └── config.ts
│
├── yeschef-app/              # Expo Android app → Shipyard (Google Play)
│   ├── app.json
│   ├── eas.json
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx         # Home (paste URL)
│   │   ├── profile.tsx       # Settings, history
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   └── signup.tsx
│   │   ├── recipe/
│   │   │   └── [id].tsx      # Recipe detail
│   │   └── cook/
│   │       └── [id].tsx      # Live cook (LiveKit RN)
│   ├── components/
│   │   ├── RecipeCard.tsx
│   │   ├── StepCard.tsx
│   │   ├── IngredientList.tsx
│   │   ├── AudioWaveform.tsx
│   │   └── PaywallGate.tsx
│   ├── services/
│   │   ├── api.ts            # Same API calls as web
│   │   ├── supabase.ts       # Supabase client + auth
│   │   ├── revenuecat.ts     # RevenueCat init
│   │   └── livekit.ts        # Token fetching
│   ├── store/
│   │   ├── recipeStore.ts
│   │   ├── authStore.ts
│   │   └── cookStore.ts
│   ├── constants/
│   │   └── colors.ts
│   └── config/
│       └── demo.ts
│
├── EXECUTION-PLAN.md         # This file
└── README.md                 # Public-facing docs
```

---

## 🚀 Let's Go

**Two-frontend strategy:**

1. **Phases 0–5 (today → Feb 9):** Backend + React web app → Gemini 3 submission
2. **Phases 6–8 (Feb 9–12):** Port to Expo Android + add auth/paywall → Shipyard submission

**Start with Phase 0.** First action: sign up for LiveKit Cloud while we create the React web project.

When ready, say **"Phase 0"** and we build.
