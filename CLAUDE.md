# routing-statistics

Visualization tool for the **Routing Game** — a physical scouting/camp game. Reads NFC scan logs from a SQLite DB.

**Two modes:**
1. **Replay/Analysis** — re-watch a completed session, analyze routing efficiency and material flow
2. **Live Monitor** — real-time view of stock levels, truck positions, and rocket production progress

**GitHub:** https://github.com/JeeRik/routing-statistics (personal account, branch: master)  
**Git identity:** always use local repo config — `Jiri Marek <marejir@gmail.com>` (work account is the global default on this PC)

---

## What's built

### Running the app

```bash
# Terminal 1 — backend (requires Python 3.12+)
cd backend
py -3.12 -m pip install -r requirements.txt
py -3.12 -m uvicorn main:app --reload --port 8000

# Terminal 2 — frontend dev server
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api → :8000
```

Always use `--reload` on the backend so model changes take effect without a manual restart.

**Quick server management (PowerShell from project root):**
```powershell
.\dev.ps1           # stop existing + restart both in new windows (default)
.\dev.ps1 stop      # stop only
.\dev.ps1 start     # start only
```

### Project structure

```
routing-statistics/
├── backend/
│   ├── main.py       # FastAPI app + API routes
│   ├── db.py         # SQLite query layer (read-only, no ORM)
│   ├── models.py     # Pydantic request/response models
│   ├── replay.py     # Event-driven replay engine
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx                    # Thin routing shell — <BrowserRouter> is in main.tsx
│       ├── main.tsx                   # Entry point; wraps App in BrowserRouter
│       ├── api/client.ts              # Typed fetch wrappers
│       ├── types/game.ts              # Shared TypeScript interfaces
│       ├── constants.ts               # MATERIAL_COLORS, MATERIAL_IDS, MATERIAL_NAMES
│       ├── data/
│       │   └── processSets.ts         # Three predefined process sets (tier1, tier1_2, full); MATERIAL_NAME_COLORS; processOutputColor(); detectProcessSet()
│       ├── components/
│       │   ├── AppHeader.tsx          # Persistent header with nav links to /rounds and /topologies
│       │   ├── NetworkMap.tsx         # ReactFlow graph, snap-to-grid (fixed 160 px); permanent MaterialPicker panel in bottom-right
│       │   ├── CustomEdge.tsx         # Draggable quadratic-bezier arc edges; snaps to straight within 12 px; renders animated traffic/distribution highlights
│       │   ├── StationNode.tsx        # Node with supply/cargo rows + process popover (fixed width 105 px); background tinted by output material color
│       │   ├── TopologyCanvas.tsx     # ReactFlow editor canvas for topology editing; shift+drag to connect nodes; alt+click for process picker; ctrl+drag for grid snap
│       │   ├── ProcessPicker.tsx      # Portal popup: 3×3 colored grid + rocket + none; opened by alt+click on a node in the topology editor
│       │   ├── MaterialPicker.tsx     # Reusable 3×3 material color grid (tier-based layout) with SVG dependency-graph overlay; supports read-only mode
│       │   ├── SupplyBadge.tsx        # Storage badge: solid material-color border, black→color fill bottom-to-top (max at 30); hover shows delivery history popup
│       │   ├── TruckBadge.tsx         # Fill-level-aware truck bubble (cargo row, capacity 5); hover shows full scan-history popup
│       │   └── ReplayControls.tsx     # Play/pause scrubber; Space bar toggles playback
│       └── pages/
│           ├── RoundsList.tsx         # /rounds — table of sessions with inline name editing
│           ├── Visualizer.tsx         # /visualize/:roundId — network map + replay
│           ├── TopologyList.tsx       # /topologies — table of saved topologies with edit/delete
│           └── TopologyEditor.tsx     # /topology/new and /topology/:id/edit — sidebar + canvas editor; auto-saves 800 ms after last change
├── layout/
│   └── <round_id>.json   # Persisted node positions + edge offsets + custom name
├── topologies/
│   └── <id>.json          # User-designed topology files (git-tracked); same schema as game round_def + editor_positions field
├── data/
│   └── game-logs-2026-03-26.sqlite3   # committed to git
└── dev.ps1                            # Stop/start both servers (PowerShell)
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rounds` | List rounds with event counts |
| GET | `/api/round/{id}/definition` | Round def (routers, links, processes, materials) |
| GET | `/api/round/{id}/events` | All events, sorted by time (cached in memory) |
| GET | `/api/round/{id}/state?time_ms=N` | Computed game state at time N |
| GET | `/api/round/{id}/truck/{card_id}/history?time_ms=N` | Scan history for one truck up to time N — `[{time_ms, node, cargo}]` |
| GET | `/api/round/{id}/node/{node}/material/{mat_id}/history?time_ms=N` | Delivery history for one material at one node up to time N — `[{time_ms, delta, card_id}]` (card events where routerDelta ≠ 0) |
| GET | `/api/round/{id}/traffic?time_ms=N&from_ms=F` | Goods and trips per directed edge for trips that arrived in `[F, N]` — `{"edges": {"AB": {"goods": N, "trips": M, "by_material": {"2": {"goods": N, "trips": M}}}}}`. `from_ms` defaults to 0 (whole game). |
| GET | `/api/round/{id}/distribution?time_ms=N&material_id=M` | Per-node delivered and taxed counts for material M up to time N — `{"nodes": {"A": {"delivered": N, "taxed": N}}}`. `delivered` = sum of abs(routerDelta) for card events where routerDelta < 0 (truck deposited); `taxed` = sum of linkDelta for card events where linkDelta > 0 (customs toll). |
| GET | `/api/layout/{id}` | Load saved layout (404 if none) |
| POST | `/api/layout/{id}` | Save layout — **merge** with existing file, not overwrite |
| GET | `/api/topologies` | List all topology files — `[{id, name, station_count, link_count}]` |
| GET | `/api/topology/{id}` | Load full topology JSON |
| POST | `/api/topology/{id}` | Save (overwrite) topology JSON |
| POST | `/api/topologies/new` | Create new topology — assigns next available integer ID, returns `TopologySummary` |
| DELETE | `/api/topology/{id}` | Delete topology file |

### Layout file format

```json
{
  "positions":    { "A": {"x": 120, "y": 340}, ... },
  "edge_offsets": { "A-B": {"ox": 0, "oy": -40}, ... },
  "custom_name":  "Game night 2026-03-26"
}
```

Layout saves are **partial merges** (`exclude_unset=True`): saving positions never erases a custom name and vice versa.

### Replay engine

`replay.py::compute_state(events, round_start_ms, time_ms)`:
- Iterates events sorted by `next_attention` (ms epoch) up to `round_start_ms + time_ms`
- `transEnd` events → update station stock from `routerStorage`; accumulate `routerDelta` into per-station `produced` counts
- `card` events → update truck location (`router` field) and load (`cardStorage`), update station stock; trucks with zero cargo after the event are **removed** from `trucks` (not kept as empty entries)
- Returns `GameState` with `stations` (stock + produced per material) and `trucks` (location + load; only non-empty trucks included)

### Routes

| Path | Page |
|------|------|
| `/` | Redirects to `/rounds` |
| `/rounds` | Table of all rounds — columns: ID, Name (editable), Topology, Events, Duration, Open |
| `/visualize/:roundId` | Network map + replay for the selected round |
| `/topologies` | List of user-designed topologies with edit/delete actions |
| `/topology/new` | Topology editor — blank canvas; auto-creates file on first change |
| `/topology/:topoId/edit` | Topology editor — loads existing topology from file |

### UI behaviours to know

- **Rounds table — Name column:** click any name cell to edit inline; Enter/blur saves to `layout/<id>.json`; Escape cancels. Shows `round_name` from DB as default when no custom name is set.
- **Rounds table — Topology column:** `#nodes / #edges` fetched from `/api/round/{id}/definition`.
- **Edge drag:** grab anywhere on an arc to reshape it (quadratic bezier, offset stored as `{ox, oy}` from midpoint); snaps to perfectly straight when the control point is within 12 px (graph coords) of the straight line
- **Node snap:** hold **Ctrl** while dragging a node to snap to a fixed 160 px grid; a banner confirms when active
- **Node anchor:** edges connect at horizontal center + middle of the letter row (18px from top). Nodes have fixed width (105 px) so the anchor is stable during replay.
- **Layer toggles:** Storage shows a supply row (inputs left, output right). Cargo shows truck bubbles (non-empty trucks at each station, ≤4 per row). Distribution and Traffic are described below.
- **Distribution layer:** a 3×3 material color picker (bottom row = raw A/B/C, middle = tier-2 D/E/F, top = tier-3 G/H/I) plus a red ⛔ **None** button to the right. Selecting a material shows: producers `⚙ +produced` (grey cog), consumers `🚚 -delivered / ⛔ -taxed` (azure truck / red stop), toll-only nodes `⛔ -taxed`, others an empty spacer — all numbers in the material's color. Each edge gets an animated strip in that material's color at 40 %→80 %→40 % opacity, width scaled to the busiest edge. Fetches `/distribution` (node stats) and `/traffic` (edge stats) on every time or material change; no fetch when None is selected. Node box background is mildly tinted with the output material color (12 % blend).
- **MaterialPicker panel:** always visible in the bottom-right corner of the canvas. Shows the same 3×3 grid with SVG dependency lines (computed from round definition processes; lines connect each input material to each output material). Read-only — highlights the currently selected material but clicks do nothing. The dependency graph automatically reflects different round topologies.
- **Traffic layer:** when enabled, each directed edge shows an animated highlight strip to the right of the arc in the direction of travel. Width scales with goods transported (normalized to the busiest edge). The strip uses a grey (`#8a9aaa`) base color at 40 %→80 %→40 % opacity animated with SMIL `animateTransform` (60 px period, 1.2 s cycle) so the pattern flows in the direction of traffic. Both directions of a bidirectional edge are shown simultaneously as two strips, one on each side. Hover shows a per-material popup table: color swatch · trip count · goods count. The hit area is always the maximum strip width for easy hovering. Under the Traffic checkbox, a radio group selects the aggregation window: **Whole game** (all trips up to `time_ms`), **Last 60 s** (`from_ms = time_ms − 60 000`), **Last 20 s** (`from_ms = time_ms − 20 000`). All three modes are live; the backend filters by trip arrival time via `from_ms`.
- **Supply badges:** solid border in the material's color; background fills from black (0 items) to full material color (30 items) bottom-to-top via a sharp CSS gradient; glow when count > 30. Hover fetches `/api/round/{id}/node/{node}/material/{matId}/history?time_ms=N` and shows a portal popup with header `Node : Color` and one delivery line per truck scan (`mm:ss : +N : card_id`).
- **Process popover:** hovering the letter/name area of a node shows a portal-rendered tooltip (above all ReactFlow nodes) with the factory recipe and cumulative items produced at current replay time.
- **Truck history popup:** hovering a truck bubble fetches `/api/round/{id}/truck/{cardId}/history?time_ms=N` and shows a portal popup with header `Card Id: <id> : <colour>` and one log line per scan (`mm:ss : node : cargo`), including zero-cargo hops. Scrollable, max 220 px tall.
- **Space bar:** toggles play/pause in `ReplayControls`; ignored when an input/select/textarea/button has focus.
- **Material name ↔ ID mapping:** process inputs/outputs in `round_def` use name strings (`"blue"`); game-state stock uses numeric string IDs (`"2"`). `MATERIAL_IDS` in `constants.ts` maps names → IDs for the supply row lookup.

### Topology editor behaviours

- **Process sets:** three predefined sets in `processSets.ts` — `tier1` (blue/yellow/green raw), `tier1_2` (+ gray/orange/pink tier-2), `full` (all 10 including rocket). Switching sets remaps router processes, keeping any process whose name still exists in the new set or is `factory_rocket`.
- **Auto-save:** changes to `topo` or `positions` start an 800 ms debounce timer; the first run after load is skipped. For new topologies the first auto-save calls `POST /api/topologies/new` and navigates to `/topology/:id/edit` (replace history). For existing topologies it calls `POST /api/topology/:id`. A "Saving…" / "Saved" indicator appears in the sidebar bottom.
- **Node interactions:** click → select (sidebar shows label + process); alt+click → `ProcessPicker` popup at cursor; shift+drag node→node → bidirectional edge (both "AB" and "BA" added); ctrl+drag → move with 160 px grid snap; drag → free move; Delete key → remove selected node.
- **Edge interactions:** drag arc → reshape (quadratic bezier, same as visualizer); shift+click edge → delete edge; shift+drag edge → no-op.
- **ProcessPicker:** portal-rendered popup; 3×3 grid matching `MaterialPicker` tier layout (row 0 = brown/red/purple, row 1 = gray/pink/orange, row 2 = blue/yellow/green); cells dimmed when not in current process set; `factory_rocket` always available as a separate button; "none" clears the process. `factory_rocket` is auto-added to the topology's `processes` dict when selected.
- **Connection line:** shift+drag from a node shows a dashed cyan SVG line (portal-rendered, `pointer-events: none`); start snaps to the source node center; end snaps to the center of any valid target node under the cursor.
- **Topology storage:** `topologies/<id>.json` — same JSON schema as game `round_def` plus `editor_positions: { "<letter>": {x, y} }`. Edge arc offsets are not persisted (editor limitation). `_positions` must be `editor_positions` — Pydantic v2 treats underscore-prefixed fields as private.

### Known data quirks (round 21)

- `routerStorage` is the absolute current stock at a router, not a delta — use the latest value seen before time T
- `routerDelta` in **card** events: negative = truck delivered to router (router gained material); positive = truck picked up from router (router lost material). Sign is opposite to what the name implies.
- `linkDelta` in **card** events: positive = customs toll deducted at this scan (goods lost); 0 = no toll. Appears at the factory scan where the toll is applied, not at the customs box.
- Station H accumulates blue material (>100 units by mid-game) because trucks stopped collecting — this is real game data, not a bug
- Round 21 has 16 stations (A–P), 56 directed links, 1200 s duration
- `round_start_time` is stored in `game` table as a Unix float (seconds); multiply by 1000 for ms

---

## The Game

A physical game for up to 26 players (groups KSI and IBIS). Goal: build a rocket by transporting and assembling materials across a network of factory stations.

- **Stations:** X stations in terrain, each with one factory (NFC reader + display)
- **Paths:** Each path between stations has a **customs box** (celní krabice) in the middle — the only place players may talk or exchange notes
- **Rounds:** 15–20 min each; 3 rounds per session

### Factory types

| Type | Czech | Behavior |
|------|-------|----------|
| Producer | Výrobna | Generates one raw material automatically over time |
| Assembly | Montovna | Consumes inputs → produces output; only runs when ALL inputs are in stock |

### Material production chain

| ID | Recipe | Icon (Material Icons) | Color | Hex |
|----|--------|-----------------------|-------|-----|
| A  | raw    | token `ea25`               | Blue    | `#37abc8` |
| B  | raw    | bolt `ea0b`                | Yellow  | `#ffcc00` |
| C  | raw    | science `ea4b`             | Green   | `#aad400` |
| D  | A+B    | settings `e8b8`            | Gray    | `#93a7ac` |
| E  | B+C    | memory `e322`              | Orange  | `#d45500` |
| F  | C+A    | biotech `ea3a`             | Pink    | `#d35f8d` |
| G  | D+E    | cell_tower `ebba`          | Red     | `#d40000` |
| H  | E+F    | screenshot_monitor `ec08`  | Purple  | `#aa87de` |
| I  | F+D    | precision_manufacturing `f049` | Brown | `#a05a2c` |
| J  | G+H+I  | rocket_launch `eb9b`       | White   | `#ffffff` |

Card quantities: A/B/C = 80x, D/E/F = 40x, G/H/I = 15x, J = 0x (assembled in-game).  
Icons: **Material Icons** (NOT Material Symbols).

### Trucks (NFC cards = kamiony)

- Each truck color carries exactly one material type; capacity = 5 units
- Loading: scan at a factory that produces the matching material
- Transport: carry to your customs box; neighbor picks it up
- **Customs toll:** picking up from a customs box costs 1 unit (deducted on scan at your factory)
- **Crash rule:** skipping a customs-box scan = truck crashes, unusable for the rest of the round
- Unloading: scan at an assembly factory that needs the material → entire cargo auto-transfers to input stock

---

## DB schema

File: `data/game-logs-2026-03-26.sqlite3`  
Tables: `game`, `box_events`, `router_states`

### `game` (1 row)

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | |
| game_state | INTEGER | 2 = active |
| round_start_time | REAL | Unix timestamp (seconds) |
| round_pause_time | REAL | Unix timestamp (seconds) |
| tick_duration_ms | INTEGER | ms per tick (1000 in snapshot) |
| round_def | TEXT | JSON — full round definition |

**round_def JSON:**
```json
{
  "roundId": 21,
  "roundName": "4_mod3",
  "duration": 1200,
  "processes": {
    "<process_name>": { "inputs": {"<material>": int}, "outputs": {"<material>": int}, "duration": int }
  },
  "materials": { "<material>": {"capacity": int} },
  "routers": { "<letter>": {"label": str, "processes": ["<process_name>"]} },
  "links": ["AB", "BC", ...],
  "events": []
}
```
Links are directed: `"AB"` = path from A to B.

### `box_events` (~230K rows)

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| round_id | INTEGER | matches roundId in round_def |
| next_attention | INTEGER | ms epoch timestamp |
| data | TEXT | JSON event payload |
| processed | INTEGER | 0 = unprocessed |

Round IDs present: 1–17, 21, 42, 123.  
**Round 21 is the real game** (~9,660 events). Rounds 42 and 123 are dev/test (generic factory names).

**Event payload:**
```json
{
  "routerMac": "aa:bb:cc:dd:ee:ff",
  "router": "A",
  "event": { "type": "transStart|transEnd|card", "time": 1, "tick": 1, ... }
}
```

**transStart** — factory begins a production cycle
```json
{ "type": "transStart", "procId": "factory_blue", "routerDelta": {}, "routerStorage": {"2": 0} }
```

**transEnd** — factory completes a cycle (material produced)
```json
{ "type": "transEnd", "procId": "factory_blue", "routerDelta": {"2": 1}, "routerStorage": {"2": 1} }
```

**card** — NFC truck scanned at a router
```json
{
  "type": "card",
  "cardId": "2-003",
  "bearer": "04:xx:xx:xx:xx:xx:80",
  "linkDelta": {"2": 0},
  "routerDelta": {"2": 1},
  "cardStorage": {"2": 1},
  "routerStorage": {"2": 0}
}
```
`cardId` format: `"<material_id>-<card_number>"` — e.g. `"2-003"` = card #3, blue material.  
`linkDelta` = customs toll (0 when scanning at a factory, non-zero at a customs box).

### `router_states` (~148K rows)

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK |
| round_id | INTEGER | |
| router_id | INTEGER | numeric device ID (65–81 in round 21) |
| game_time_ms | INTEGER | |
| game_ticks | INTEGER | |
| router_state | TEXT | JSON: `{"storage_state": {"<mat_id>": int}, "processes": [{"name": str, "is_running": bool, "ticks_since_started": int}]}` |

`router_id` identifies the physical device. router_id=81 has empty processes (likely a customs-box node).

### Material numeric ID → name (round_id=21)

| ID | Name   | Hex     |
|----|--------|---------|
| 1  | gray   | #93a7ac |
| 2  | blue   | #37abc8 |
| 3  | purple | #aa87de |
| 4  | pink   | #d35f8d |
| 5  | red    | #d40000 |
| 6  | orange | #d45500 |
| 7  | yellow | #ffcc00 |
| 8  | green  | #aad400 |
| 9? | brown  | #a05a2c |

Brown (9?) not confirmed — not observed in transEnd events in snapshot.
