# Frenzy draft

Plan for FRZ-3: the public page where frenzy captains pick their teams from the event's signups. Submodules: api-backend, web-app.

## Settled

| Rule | Decision |
|---|---|
| Captains | Staff choose them from the signups, one per team. A signup can tick "willing to captain". |
| Pick order | The site draws a random round-1 order when staff start the draft and shows it before the first pick. Each later round reverses (snake). |
| Pick timer | None. Staff can make a pick for an absent captain. |
| Live view | Each pick pushes over the API's existing websocket to everyone watching. No polling. |
| Scale | A team usually has 15 to 100 members, so an event has from about 60 to several hundred signups. |
| Modes | Full draft and Top Picks both exist. Staff choose one per event. |
| Top picks | Staff set `x` per event. The field starts at 5. |
| After the draft | Staff may move any member between teams before the event starts, drafted picks included. |

## Modes

Staff choose the mode when they set up the draft.

| Mode | What captains pick | What happens to the rest |
|---|---|---|
| Full draft | Every signup, in snake order, until the pool is empty | Nothing is left |
| Top Picks | `x` picks each, in snake order | The site hands out every remaining signup in the same snake order when the last top pick is made |

Top Picks keeps the captains' choices for the first `x` rounds and removes the hundreds of manual picks that a full draft needs at this scale.

### Top Picks flow

1. Staff close signups, choose the captains, choose Top Picks and set `x` (5 to start).
2. Staff draw the order. The draft page shows the captains in round-1 order and "x picks each".
3. Staff start the draft. Captains pick in snake order for `x` rounds. Staff can pick for an absent captain.
4. The last top pick triggers the hand-out. The page shows each team's top picks first, then the members the site placed, marked as auto.
5. Staff can move any member between teams before the event starts.

### The hand-out

The hand-out continues the snake. From round `x + 1` on, the site takes the highest-ranked signup left for the captain whose turn it is, until the pool is empty. The order of the rounds stays the snake the captains drafted in. Ties in ranking score go to the earlier signup.

The hand-out is a pure function of the drawn order, the picks so far and the pool's ranking scores, so its result is the same on every run. It does not reuse the Tile Race balancing draft, which places by score mass instead of by snake order.

## Data

| Change | Purpose |
|---|---|
| `frenzy_signups.wants_captain` | The signup's opt-in |
| `frenzy_signups.team_id`, `pick_number`, `pick_kind` (`captain`, `drafted`, `auto`) | Where each signup ended up and how |
| `frenzy_drafts`: event, mode, `top_picks`, drawn order, state (`setup`, `drawn`, `picking`, `complete`), next pick number | One draft per event |
| Teams | Created from the captains when the order is drawn. A team's `participants` comes from its signups, so a Wise Old Man sync and a draft do not both write it |

## Routes

| Route | Who | Does |
|---|---|---|
| `PUT /frenzy/events/{id}/draft` | staff | Sets the captains, the mode and `x` while the draft is in setup |
| `POST /frenzy/events/{id}/draft/moves` | staff | Moves a member to another team after the draft and before the event starts |
| `POST /frenzy/events/{id}/draft/draw` | staff | Draws the order and creates the teams |
| `POST /frenzy/events/{id}/draft/start` | staff | Opens pick 1 |
| `POST /frenzy/events/{id}/draft/picks` | the captain on turn, or staff | Makes the pick; in Top Picks the last one runs the hand-out |
| `GET /frenzy/events/{id}/draft` | public | The draft state, the teams in drawn order and the pool, strongest first |
| `DELETE /frenzy/events/{id}/draft` | staff | Removes the draft and its teams; every signup returns to the pool |
| `WS /frenzy/draft/live` | public | Sends `{"type": "draft", "event_id": n}` on each change; the page refetches the view |

Each change publishes the event id on the Valkey channel `frenzy:draft`. Each gunicorn worker subscribes and tells its own sockets.

## Page, at this scale

The picked layout is D5 Grid first on the bench (`previews/site-theme/frenzy-draft.html`): the turn head, the snake grid across the page, the pool beside the recent picks, then every team's full roster. The parts:

- The pool is a virtual list with search, a CC rank filter and sort.
- Recent picks list the newest 10 picks with captain and round.
- A team column shows its captain, its count against its size and its whole roster as a virtual list. Handed-out members carry "auto".
- In Top Picks, the grid draws the `x` top-pick rounds and folds the handed-out rounds into one row. In Full draft, the grid shows a window of rounds around the current pick.
- Staff see Move to on each member of a finished draft.
- A signup stores the member's IANA time zone from their browser. A signed-in viewer sees each member's offset from their own zone, such as "+2h" or "-5h 30m", computed in the browser for the current moment, so daylight saving applies. A member with no stored zone shows no offset.
