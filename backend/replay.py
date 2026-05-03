from models import GameState, StationState, TruckState


def compute_state(events: list[dict], round_start_ms: int, time_ms: int) -> GameState:
    """
    Replay all events up to `time_ms` (game-relative ms from round start)
    and return the derived game state.
    """
    stations: dict[str, dict[str, int]] = {}
    produced: dict[str, dict[str, int]] = {}
    trucks: dict[str, dict] = {}

    for ev in events:
        ev_game_time = ev["_ts"] - round_start_ms
        if ev_game_time > time_ms:
            break

        router = ev.get("router")
        inner = ev.get("event", {})
        ev_type = inner.get("type")

        if router and router not in stations:
            stations[router] = {}

        if ev_type == "transEnd":
            router_storage = inner.get("routerStorage", {})
            router_delta = inner.get("routerDelta", {})
            if router:
                stations[router] = {str(k): v for k, v in router_storage.items()}
                node_produced = produced.setdefault(router, {})
                for mat_id, qty in router_delta.items():
                    mat_key = str(mat_id)
                    node_produced[mat_key] = node_produced.get(mat_key, 0) + qty

        elif ev_type == "card":
            card_id = inner.get("cardId", "")
            card_storage = inner.get("cardStorage", {})
            router_storage = inner.get("routerStorage", {})
            if router:
                stations[router] = {str(k): v for k, v in router_storage.items()}
            if card_id:
                new_load = {str(k): v for k, v in card_storage.items() if v > 0}
                if new_load:
                    trucks[card_id] = {"location": router or "", "load": new_load}
                else:
                    trucks.pop(card_id, None)

    return GameState(
        stations={k: StationState(stock=v, produced=produced.get(k, {})) for k, v in stations.items()},
        trucks={k: TruckState(location=v["location"], load=v["load"]) for k, v in trucks.items()},
        time_ms=time_ms,
    )
