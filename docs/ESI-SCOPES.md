# ESI scope profiles

ESI scopes are permissions granted by an EVE player to an EVE Developer Application. They are separate from the bridge's MCP scopes (`eve.read` / `eve.write`).

This document gives **starting profiles**, not a recommendation to request everything.

## Minimal principle

Request the smallest set that supports your intended prompts.

Broad ESI authorization has two costs:

1. a compromised refresh token has broader value;
2. the user has a harder time understanding what they are consenting to.

## Profile: current ship/location + skills

```text
esi-location.read_location.v1
esi-location.read_ship_type.v1
esi-location.read_online.v1
esi-skills.read_skills.v1
esi-skills.read_skillqueue.v1
```

Useful for fit eligibility, current ship context and skill planning.

## Profile: personal economics

Add:

```text
esi-wallet.read_character_wallet.v1
esi-assets.read_assets.v1
esi-characters.read_loyalty.v1
esi-markets.read_character_orders.v1
```

Useful for current wallet/assets/LP/orders. Public regional market orders/history do not require these character scopes.

## Profile: fit/account state

Add only as needed:

```text
esi-fittings.read_fittings.v1
esi-clones.read_clones.v1
esi-clones.read_implants.v1
esi-characters.read_standings.v1
```

## `.env.example` starter

The shipped starter combines common read-oriented character facts:

```text
esi-assets.read_assets.v1
esi-location.read_location.v1
esi-location.read_ship_type.v1
esi-location.read_online.v1
esi-skills.read_skills.v1
esi-skills.read_skillqueue.v1
esi-wallet.read_character_wallet.v1
esi-characters.read_loyalty.v1
esi-characters.read_standings.v1
esi-fittings.read_fittings.v1
esi-markets.read_character_orders.v1
esi-clones.read_clones.v1
esi-clones.read_implants.v1
```

Reduce this list when you do not need all of those data families.

## Public ESI does not need character scopes

Examples of official public information include many universe/type/system/market/routing/FW/server endpoints. The bridge's `eve_public_get` does not attach the EVE bearer token.

Prefer public ESI for public facts instead of requesting a private scope that is unnecessary.

## Corporation and alliance scopes

Corporation endpoints can require both OAuth scope and in-game roles. Having a scope in the token does not guarantee the character has the corporation authority required by ESI.

If you add corporation scopes, treat 403 responses as actual authorization facts rather than as a reason to bypass the gateway checks.

## Optional write scopes

The current write allowlist can make use of ESI scopes such as:

```text
esi-ui.write_waypoint.v1
esi-ui.open_window.v1
esi-fittings.write_fittings.v1
esi-characters.write_contacts.v1
esi-mail.send_mail.v1
esi-mail.organize_mail.v1
esi-calendar.respond_calendar_events.v1
esi-fleets.write_fleet.v1
```

Do not add these merely because the code knows about the corresponding route. Add only what you intend the LLM client to use.

To actually expose write tools, you must also set:

```text
EVE_ENABLE_WRITE_ACTIONS=true
```

The two controls are intentionally independent.

## Why a scope is not the same as an action

A scope says a token may be used with an ESI permission family. It does not mean every operation in that family is exposed by this bridge.

Effective write access is the intersection:

```text
EVE app enabled scope
AND user granted scope
AND current EVE token contains scope
AND current in-game role permits operation (when applicable)
AND bridge write mode enabled
AND operation matches bridge allowlist
AND MCP connection has eve.write
```

This layered model prevents a broad OAuth grant from automatically becoming an arbitrary LLM mutation surface.

## Scope changes and reauthorization

After changing `EVE_ESI_SCOPES`, reconnect/re-authorize the MCP client so EVE shows the new consent set and returns a token containing the intended scopes.

Use `eve_status` to inspect what was actually granted rather than trusting configuration alone.
