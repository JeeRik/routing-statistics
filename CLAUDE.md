# routing-statistics

Visualization tool for the **Routing Game** — a physical scouting/camp game. Reads NFC scan logs from a SQLite DB.

**Two modes:**
1. **Replay/Analysis** — re-watch a completed session, analyze routing efficiency and material flow
2. **Live Monitor** — real-time view of stock levels, truck positions, and rocket production progress

**GitHub:** https://github.com/JeeRik/routing-statistics (personal account, branch: master)  
**Git identity:** always use local repo config — `Jiri Marek <marejir@gmail.com>` (work account is the global default on this PC)

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
