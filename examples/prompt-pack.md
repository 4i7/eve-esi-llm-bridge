# Prompt pack

These prompts demonstrate the intended separation between live ESI facts, client-only evidence, web gaps and actions.

## Connection check

```text
Use the EVE MCP tools. Call eve_status and summarize which EVE character is connected, which ESI scopes are actually granted, and whether write actions are enabled.
```

## Current-state hydration

```text
Fetch my current API-visible EVE state needed to answer this question. Do not ask me to manually type wallet, ship, location or skill information if the authenticated ESI tools can retrieve it. Tell me which current facts could not be fetched because of missing scopes.
```

## Fit validation

```text
I want a fit for [activity]. First fetch the relevant current trained skills and current ship/account facts available from ESI. Use official ESI type/dogma data where it answers module/mechanical questions. Separate skill eligibility, hard game facts, practical/meta advice and assumptions.
```

## Money-making comparison

```text
Compare these EVE activities using realistic net ISK/hour. Use current wallet/assets/LP/orders and public market data from ESI where relevant. Include travel/search/setup, competition, ammo/drones, taxes/spread/liquidity, loss exposure, capital lock and attention burden. Do not use one rare jackpot as the average.
```

## Public route research

```text
Resolve the system names with official ESI, calculate/inspect the official route data available from ESI, and add current public system jump/kill data. If I need live camp intelligence that ESI does not provide, say that explicitly before using a current third-party source.
```

## Screenshot + API enrichment

```text
Treat the screenshot as direct client evidence. First list what is actually visible. Then enrich names/systems/types with ESI. Keep facts from the image, API facts and your inferences separate. Do not claim ESI can see the rest of my Overview/Local/scanner.
```

## Capability discovery

```text
Call eve_capabilities. Group the currently visible capabilities into character state, market/economics, fitting, route/universe, corporation/fleet and optional actions. Distinguish "route is visible from scope/OpenAPI" from "this call is guaranteed to succeed".
```

## Prepare a low-impact UI action

```text
Find the exact system ID for [system]. If write actions are enabled and the waypoint UI action is available, prepare the exact waypoint action but do not claim it has executed until the execute tool returns an actual ESI result.
```

## Execute an explicitly requested action

```text
Set the destination/waypoint we just selected. Use the bridge's prepare -> execute flow. Show me the exact target before executing and report the real ESI response status afterward.
```

## Do not over-automate

```text
Tell me what part of this plan can be done through ESI and what still requires the EVE client. Do not describe client-only warp/combat/module/scanning behavior as if this MCP server can execute it.
```
