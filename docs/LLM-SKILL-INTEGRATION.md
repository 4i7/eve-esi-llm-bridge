# Turn the bridge into an LLM skill

The MCP bridge is the **data/action plane**. A skill is the **reasoning and routing policy** that tells a model when to use each tool, how to combine evidence and how to present uncertainty.

Keeping them separate makes the code reusable across ChatGPT, Claude, Codex and other agents.

## 1. Recommended evidence hierarchy

A high-quality EVE assistant should distinguish five evidence classes.

### A. Authenticated current ESI

Use for current API-visible character/account facts such as:

- location/ship/online state;
- skills/queue;
- wallet;
- assets;
- loyalty points;
- standings;
- saved fittings;
- orders/contracts where scoped;
- clones/implants;
- industry and other ESI-visible state.

Rule:

> Ask the player for preferences; fetch API-visible facts.

Do not make the user repeatedly export skills or type wallet values that authenticated ESI can retrieve.

### B. Official public ESI

Use before general web search for official public API facts, for example:

- systems/regions/constellations/stations/stargates;
- inventory type/dogma metadata;
- public regional markets/history;
- routes;
- public FW data;
- system jumps/kills;
- server status;
- public contracts/wars where exposed.

### C. Direct client evidence

Some important EVE state is not in ESI. Use player-provided screenshots, combat logs, copied UI lists and fits for:

- current anomaly/site scanner contents;
- Overview/Local state;
- live combat presentation;
- some mission/event UI state;
- client-only timers/messages.

The skill should state what is directly visible before inferring causes.

### D. Historical measured evidence

Use the player's own structured logs/observations for realized outcomes such as clear times, losses, loot, search time and realized ISK/hour.

Do not silently turn one lucky drop into an average.

### E. Web/community evidence

Use current web sources for genuine gaps:

- patch notes;
- current meta/community practice;
- third-party killboard/live-intel analysis;
- undocumented practical behavior;
- current price context when ESI alone is insufficient.

Web evidence should not replace an official current ESI field that the bridge can retrieve directly.

## 2. Reference skill file

`skills/eve-esi-assistant/SKILL.md` is a generic Agent-Skills-style starter. It deliberately references tool names, not private repository concepts.

Adapt its front matter to the target platform if necessary.

## 3. One-shot prompt to another LLM

You can give another model this repository and use:

```text
Read this repository, especially README.md, docs/ARCHITECTURE.md,
docs/SECURITY.md, docs/ESI-SCOPES.md and app/api/[transport]/route.js.

Create a reusable EVE Online assistant skill for your native skill format.
The skill must use the exposed MCP tools rather than reimplement authentication.

Evidence order:
1. authenticated ESI for current API-visible private facts;
2. public ESI for official public facts;
3. direct screenshots/logs/fits for client-only facts;
4. measured historical observations for realized outcomes;
5. current web/third-party sources only for gaps;
6. inference last and explicitly labeled.

Never invent current wallet/assets/location/skills/LP/standings when the tools can
fetch them. Never infer live anomaly presence from unrelated system statistics.
Treat scope possession as capability evidence, not proof that role-gated calls
will succeed.

For write operations, preserve the exact allowlist and mandatory
prepare -> execute ticket boundary. Do not create a generic arbitrary ESI write
tool. Explain destructive/external actions before execution and follow the host
product's approval requirements.

Produce:
- SKILL.md
- tool-routing rules
- evidence/freshness rules
- failure/fallback behavior
- example prompts
- validation checklist
```

## 4. Skill design: request scoping

Before fetching, identify:

- goal;
- current character/ship if relevant;
- activity/system/region;
- budget/risk/attention preferences;
- time horizon;
- whether an action is requested or only advice.

Do not ask for API-visible facts that can be hydrated automatically after OAuth.

## 5. Skill design: shared evidence bundle

For a broad decision, avoid having every sub-skill independently refetch the same data.

A useful bundle might contain:

```json
{
  "character": {},
  "location": {},
  "ship": {},
  "skills": {},
  "wallet": {},
  "assets": {},
  "public_market": {},
  "system_risk": {},
  "direct_evidence": [],
  "historical_observations": [],
  "web_gap_evidence": []
}
```

Fetch only what the current question needs.

## 6. Skill design: freshness

Each fact needs an implicit freshness class.

Examples:

- current location: live/very short lived;
- wallet: current API request;
- trained skill level: changes slowly but should still be fetched for fit validation;
- historical clear-time record: durable dated evidence;
- game mechanic patch status: current web/official patch evidence;
- EVE type static metadata: relatively durable but ESI remains authoritative when convenient.

Do not cache time-sensitive state into timeless memory without a date.

## 7. Skill design: failure behavior

When ESI returns:

### 401

Treat authorization as invalid/expired and request re-linking. Do not substitute guessed private state.

### 403

Distinguish likely causes:

- missing ESI scope;
- role/permission requirement;
- character/resource relationship.

Do not weaken the gateway to make 403 disappear.

### 404

Verify identifiers and endpoint semantics. Resolve names/IDs through official resolver tools before assuming data absence.

### 420/429/error-limit conditions

Reduce request volume, avoid repeated identical calls, and respect ESI limits/headers.

### client-only gap

State that ESI does not expose the fact and ask for a screenshot/log or use another legitimate source.

## 8. Skill design: economics

For EVE money-making advice, compare realized or realistic net value, not gross highlight drops.

Include where relevant:

- travel/search/setup time;
- site acquisition failure;
- competition;
- ammo/drone/consumables;
- replacement/loss exposure;
- market liquidity/taxes/spread;
- capital lock;
- player attention/operation burden.

The bridge can supply current account and market inputs; a skill provides the accounting model.

## 9. Skill design: fitting

Use current skill data before recommending modules the character cannot use. Prefer current type/dogma facts from ESI where they answer a mechanical question.

A fit recommendation should separate:

- validated ship/module facts;
- character skill eligibility;
- price/availability facts;
- practical combat/meta evidence;
- assumptions.

## 10. Skill design: routes

ESI can provide official routes and system statistics, but those are not complete live danger intelligence. For high-risk movement, combine ESI with current third-party/live evidence if appropriate and label source/time.

If the user asks to set a destination and write actions are enabled, the skill may prepare the exact UI waypoint action rather than pretending it can fly the ship.

## 11. Skill design: action intent

Advice is not authorization to mutate account state.

A robust skill distinguishes:

```text
"Which route is safer?"           -> research only
"Set that as my destination."     -> supported action intent
"Draft a mail."                   -> produce draft unless asked to send
"Send it."                        -> prepare exact send action
```

The host product may have its own confirmation requirements in addition to the bridge.
