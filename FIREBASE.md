# Leaderboard setup — Cloud Firestore

The game ships with the leaderboard in **local mode**: scores live in
`localStorage`, the board works, nothing leaves the machine. Connecting
Firebase makes it shared. Nothing else about the game changes.

The data model and security model are the same ones used in `pitzi-roll`:
anonymous auth, a first-come-first-served nickname registry, and one score
document per player per level that can only ever improve.

## Why REST instead of the Firebase SDK

`pitzi-roll` loads the SDK from gstatic with a dynamic `import()`. This game
cannot: it ships as one HTML file with no dependencies that has to run from a
double click, which is the first constraint in its spec.

So auth and Firestore are driven by plain `fetch()` against their REST
endpoints instead:

| Purpose | Endpoint |
|---|---|
| Anonymous account | `identitytoolkit.googleapis.com/v1/accounts:signUp` |
| Token refresh | `securetoken.googleapis.com/v1/token` |
| Read top N | `firestore.googleapis.com/v1/…/levels/{id}:runQuery` |
| Claim a nickname | `…/documents:commit` (both documents in one transaction) |
| Post a score | `PATCH …/levels/{id}/scores/{uid}` |

**The rules below are unaffected by this choice.** `request.auth.uid` is
populated identically whether the request carries a Bearer token from the REST
API or from the SDK. The only real cost is that Firestore wraps every scalar in
its type (`{"pct":{"doubleValue":0.42}}`), so the client does its own
marshalling in both directions.

## Setup

**1. Create the project.** [Firebase console](https://console.firebase.google.com)
→ new project. Add a Web app to get the config; you only need two values from it.

**2. Turn on anonymous sign-in.** Authentication → Sign-in method → Anonymous →
Enable. This is easy to miss and nothing will work without it — claiming a name
fails with `ADMIN_ONLY_OPERATION`.

**3. Create the database.** Firestore Database → Create database. Production
mode is fine; the rules below replace the defaults.

**4. Point the game at it.** In `index.html`, find `var LEADERBOARD`:

```js
var LEADERBOARD = {
  apiKey:    "AIzaSy…",     // Web API key from the Firebase config
  projectId: "neon-dash",   // project id, not the display name
  topN: 10,
  timeoutMs: 8000,
  nameMin: 2,
  nameMax: 14
};
```

Both are public identifiers, not secrets — exactly as in `leaderboard-config.js`.
What stops abuse is the rules, not the key.

**5. Publish the rules.** (Updated - re-publish if you already pasted an earlier version.) They live in **`firestore.rules`** next to
`index.html`. Paste that file into Firestore Database → Rules → Publish, or
deploy it with `firebase deploy --only firestore:rules`. Reproduced here:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn(uid)   { return request.auth != null && request.auth.uid == uid; }
    function playerName(uid) { return get(/databases/$(database)/documents/players/$(uid)).data.name; }
    function validName(n)    { return n is string && n.size() >= 2 && n.size() <= 14; }

    // Nickname registry. Document id is the lower-cased name. Never reassigned.
    match /names/{key} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(['uid', 'name'])
        && request.resource.data.uid == request.auth.uid
        && validName(request.resource.data.name)
        && request.resource.data.name.lower() == key
        && !exists(/databases/$(database)/documents/players/$(request.auth.uid));
    }

    // One profile per anonymous account, under the name it just claimed.
    match /players/{uid} {
      allow read: if true;
      allow create: if signedIn(uid)
        && request.resource.data.keys().hasOnly(['name', 'created'])
        && validName(request.resource.data.name)
        && getAfter(/databases/$(database)/documents/names/$(request.resource.data.name.lower())).data.uid == uid;
    }

    // Best run per level: only your own entry, under your claimed name, and only
    // ever moving forward. pct is the fraction of the level reached, so 1 means
    // completed; attempts is how many tries that level has taken.
    //
    // A write is allowed when the percent improves, OR when the percent is
    // unchanged and the attempt count has gone up. That second clause is what
    // lets the try counter keep climbing on a level the player has not beaten
    // yet - without it, everything after the first personal best is rejected.
    // Neither value can ever go down.
    match /levels/{level}/scores/{uid} {
      allow read: if true;
      allow create, update: if signedIn(uid)
        && request.resource.data.keys().hasOnly(['name', 'pct', 'coins', 'attempts', 'at'])
        && request.resource.data.name == playerName(uid)
        && request.resource.data.pct is number
        && request.resource.data.pct >= 0 && request.resource.data.pct <= 1
        && request.resource.data.coins is int
        && request.resource.data.coins >= 0 && request.resource.data.coins <= 3
        && request.resource.data.attempts is int
        && request.resource.data.attempts > 0 && request.resource.data.attempts < 1000000
        && (resource == null
            || request.resource.data.pct > resource.data.pct
            || (request.resource.data.pct == resource.data.pct
                && request.resource.data.attempts > resource.data.attempts));
    }    }
  }
}
```

No composite index is needed. The client orders on `pct` alone, which uses the
automatic single-field index, and applies the remaining tie-breaks locally.

## Data model

```
names/hen                       { uid: "abc…", name: "HEN" }
players/abc…                    { name: "HEN", created: 1774… }
levels/level-04/scores/abc…     { name: "HEN", pct: 0.4213, coins: 2,
                                  attempts: 87, at: 1774… }
```

`pct` is the fraction of the level reached, so `1` means completed.

The nickname claim writes `names/{key}` and `players/{uid}` in a **single
commit**, because the `players` rule validates against the names document with
`getAfter()` — which only sees writes from the same transaction. Splitting them
into two requests would be rejected.

A name is claimed once and sticks to that browser profile permanently; the rules
have no `update` on `players`, matching the pitzi-roll behaviour.

## When a score is posted

Whenever you beat your own best percent, **including on a failed run**. On a
level like *Impossible*, "how far did you get" is the interesting number long
before anyone finishes it. Practice-mode progress is never posted.

A write that does not improve your stored score is rejected by the rules with
HTTP 403. That is expected, and the client treats it as a no-op rather than an
error.

## Checking it works

Play a few seconds of any level, then Levels → SCORES. The status line under the
tabs says exactly which mode you are in:

| Status | Meaning |
|---|---|
| `LOCAL ONLY - NO FIREBASE PROJECT CONFIGURED` | `apiKey`/`projectId` still empty |
| `SYNCING...` | request in flight |
| `ONLINE` | reading from Firestore |
| `OFFLINE - SHOWING LOCAL` | request failed; local rows shown instead |

Common causes of `OFFLINE` with a project configured:

- **`API key not valid`** — wrong key, or the key is restricted to other APIs.
- **`Missing or insufficient permissions`** — rules not published yet.
- **`ADMIN_ONLY_OPERATION` when claiming a name** — anonymous sign-in is off.
- **`PERMISSION_DENIED` on the very first claim** — check that Firestore was
  actually created, not just the project.

## What this does and does not protect

The rules mean a player can only write their own row, only under the nickname
their account owns, and only upward. Someone cannot overwrite another player's
score or post under a name they do not hold.

They do not prove a score was *earned* — the client is the only witness, and a
determined person can post a plausible number through the REST API with their
own anonymous account. Server-side validation would mean replaying the input
log against the physics, which is possible here (the simulation is
deterministic) but well beyond what a portfolio leaderboard needs.
