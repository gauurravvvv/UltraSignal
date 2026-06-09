# Listing Module — Gaps Analysis (Org / Super-Admin / Org-User Lists)

**Branch:** `fix/listing-module-gaps` (mirrored in UltraSignal-API and UltraSignal-UI)
**Date:** 2026-05-14
**Scope:** Deep static analysis of three listing pages that are most-used in the admin surface:

1. Organisation list — `GET /org/list` → FE `list-organisation`
2. Super-Admin (system-admin) list — `GET /system-admin/list` → FE `list-system-admin`
3. Org-User list — `GET /user/list` → FE `list-user`

> The user asked about "org / super-admin lists." Org-User is included because the FE pattern is identical and the same fixes will be expected by users on that screen the moment org/super-admin sort lands.

---

## TL;DR — One-Line Verdict

**The frontend silently captures sort gestures and throws them away. The backend hardcodes `ORDER BY createdOn DESC` on every list controller.** No column on any of the three pages is sortable end-to-end, and the FE never sends a `sortField`/`sortOrder` to the API. Pagination + filtering work; sorting is the headline gap. Several secondary UX and contract issues also exist (see below).

---

## 1. Critical Gap — Sorting Is Not Wired End-To-End

### Backend evidence

All three controllers hardcode the sort:

| Endpoint                 | File                                             | Line | Hardcoded clause                     |
| ------------------------ | ------------------------------------------------ | ---- | ------------------------------------ |
| `GET /org/list`          | `src/controllers/organisation/listOrg.ts`        | 78   | `.orderBy('org.createdOn', 'DESC')`  |
| `GET /system-admin/list` | `src/controllers/systemAdmin/listSystemAdmin.ts` | 113  | `.orderBy('user.createdOn', 'DESC')` |
| `GET /user/list`         | `src/controllers/user/listUser.ts`               | 115  | `.orderBy('user.createdOn', 'DESC')` |

None of them read `req.query.sortBy`, `sortField`, `sortOrder`, or any equivalent. None of the validation middlewares (`listOrganisation.validation.ts`, `listSystemAdmin.validation.ts`, `listUser.validation.ts`) whitelist sort params.

### Frontend evidence

The FE wires p-table in lazy mode and **reads** `event.sortField`/`event.sortOrder` from the lazy-load event, but only to detect "did the lazy event change" — it never adds either to the request:

`src/app/modules/organisation/components/list-organisation/list-organisation.component.ts:125-173`

```ts
loadOrganisations(event: any) {
  const prev = this.lastTableLazyLoadEvent;
  if (prev && (prev.sortField !== event.sortField || prev.sortOrder !== event.sortOrder)) {
    this.selectedOrgs = [];           // only used to clear row selection
  }
  ...
  const params: any = { page, limit };   // no sortField / sortOrder placed here
  ...
  this.organisationService.load(params);
}
```

Same pattern in `list-system-admin.component.ts:239-305` and `list-user.component.ts:211-293`.

Additionally, **no column declares `pSortableColumn`** in any of the three templates (verified by `grep` returning zero matches). So even if the FE wanted to send sort params, the user has no UI affordance (no clickable column header, no sort arrow icon) to trigger it.

### Impact

- Every page silently returns rows in creation-time-descending order forever. Users cannot sort by Name, Username, Email, Last Login, Status, etc.
- Lazy-mode `p-table` re-fetches on `event` changes — clicking a header today triggers a redundant network call that returns the same hardcoded order. Performance + UX both lose.

### Fix shape

**BE — per controller (3 files):**

- Accept `sortBy` (string) + `sortOrder` (`'asc'` | `'desc'`) query params
- Whitelist sortable columns per entity (e.g., org: `name | createdOn | status`; system-admin: `username | firstName | lastName | email | lastLogin | status | createdOn`)
- Reject any value not in the whitelist with a 400 (not silent-drop)
- Default to `createdOn DESC` when params absent — preserves current behaviour
- Validation lives in each controller's validation middleware

**FE — per list component (3 files):**

- Add `pSortableColumn="<field>"` + `<p-sortIcon>` markup on each sortable header in the template
- In the component, build `sortBy` / `sortOrder` from `event.sortField` / `event.sortOrder` and add to `params`
- Map FE sort field names → BE whitelisted column names in the service layer (single source of truth per entity) so future column renames don't crack the contract

---

## 2. Backend Issues Beyond Sort

### 2.1 `limit` is unbounded — DoS-shaped

`config/config.ts` defines `MAX_ROW = 10_000_000` and every list endpoint accepts this as the default when no `limit` is passed. A single `GET /org/list?limit=10000000` returns the full table. No middleware clamps this.

**Fix:** clamp `limit` to `min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)` where `MAX_PAGE_SIZE = 200` (or whatever product agrees). Same clamp helper across all three endpoints — put it in a shared util.

### 2.2 `filter` JSON parse fails silently

In all three controllers (`listOrg.ts:72-74`, `listSystemAdmin.ts:105-107`, `listUser.ts:109-111`), `JSON.parse(filter)` is wrapped in `try/catch` that swallows the error. A malformed filter from the FE quietly becomes "no filter" and the user sees the full unfiltered list — confusing, and impossible to debug from the network tab alone.

**Fix:** return 400 with a clear message on parse failure; log the bad payload server-side.

### 2.3 Response shape is inconsistent across the API

| Endpoint             | Wraps under | Array key      |
| -------------------- | ----------- | -------------- |
| `/org/list`          | `data`      | `orgs`         |
| `/system-admin/list` | `data`      | `systemAdmins` |
| `/user/list`         | `data`      | `users`        |

Wrapping is fine (it's the convention here), but `count` lives at `data.count` and there's no page metadata (`page`, `limit`, `totalPages`). The paginator works only because the FE re-derives `totalPages` from `count / limit`. Returning `{ count, page, limit, totalPages }` would make every list consumer simpler and eliminates a class of off-by-one bugs.

### 2.4 Org list — no search by free text, no `canDelete` computed field

The other two endpoints compute `canDelete` and `isLocked` per row (e.g., `listSystemAdmin.ts:118-122`). The org list does not — yet the FE org table has a Delete action with no client-side guard. Either:

- BE should return `canDelete` (matching pattern) so the FE can disable the action defensibly, OR
- BE should reject the delete on a default/system org with a clear 4xx the FE surfaces

Currently the FE relies on the BE rejecting bad deletes mid-flight, which leaks "I clicked the button and only then learned I couldn't" UX.

### 2.5 Filter field names duplicated between controllers

`username`, `firstName`, `lastName`, `email`, `status`, `createdDateFrom/To`, `lastLoginDateFrom/To` appear identically in `listSystemAdmin.ts` and `listUser.ts`. Same logic, written twice. Worth a shared `applyUserFilter(query, filter)` helper before the surface grows.

---

## 3. Frontend Issues Beyond Sort

### 3.1 Default `[rows]="10"` hard-coded in every template

`list-organisation.component.html:57`, `list-system-admin.component.html:57`, `list-user.component.html:69` all hardcode the initial page size. The `[rowsPerPageOptions]="[10, 25, 50, 100]"` is fine, but the _default_ should be a user-level preference (or at least a constant in a single config file), not a magic number per template.

### 3.2 Fixed column widths break responsiveness

`list-organisation.component.html:80-92` hardcodes `width: 12rem`, `width: 18rem`, etc. Below ~1280px the table overflows horizontally with no scroll affordance built into the wrapper. Same pattern on system-admin and user pages.

**Fix:** switch to `scrollable + scrollHeight` on `p-table`, or use percentage / `minmax()` widths and let p-table's responsive mode handle narrow viewports. Show a horizontal scrollbar with a sticky first column.

### 3.3 Description column truncation has tooltip but no visual ellipsis cue

`list-organisation.component.html:154-156` truncates description and shows a tooltip, but there's no visible `…` indicator — users don't know there is more text to discover.

### 3.4 No keyboard focus state on row links

The Name column renders as `<a>` linking to the view page. The styling shows no `:focus-visible` outline. Keyboard users (and screen-reader users by extension) cannot tell where focus is when tabbing through rows.

### 3.5 `Last Login` empty state inconsistent

- system-admin renders the literal string `'NEVER'` (`list-system-admin.component.html:219-221`)
- user list renders an i18n key `NEVER_LOGGED_IN` (`list-user.component.html:258-264`)

Pick one. Prefer the i18n version; back-port to system-admin.

### 3.6 Filter row layout

The filter row sits _inside_ the table header (`pTemplate="caption"` / dedicated row) on all three pages, but the filter fields are uneven — date pickers expand the row height while text inputs stay short. Visually noisy. A `header-filters` flex container with consistent height per field would tidy this up without adding scope.

### 3.7 No "applied filters" chips / clear-all

When five filters are applied, the user has no summary view and no one-click way to clear. They have to revisit each control. Standard pattern: chip row above the table showing each active filter with an `×`, plus a "Clear all" button.

### 3.8 Status column renders different vocabulary across pages

- Org: `Active` / `Inactive` (two-state)
- System-admin & User: `Locked` / `Active` / `Inactive` (three-state, with `Locked` taking precedence)

This is correct per data model (orgs can't be "locked"), but the visual style differs slightly between pages. Normalize the status pill into a shared component (`<dbe-status-pill>`) so future status types ship with one CSS change.

### 3.9 Lazy-load triggers redundant network calls on sort click

Because `[lazy]="true"` and the lazy event fires on header click even without `pSortableColumn`, the FE _can_ fire an extra request when a user clicks a header. Confirm this in browser network tab during the fix; if true, gate the load on actual param-change (compare `sortField`/`sortOrder` and skip the call if the request body is unchanged).

### 3.10 No row-level loading state for inline actions

When Unlock/Delete is clicked, the icon doesn't show a spinner. The user can click twice. Add per-action `disabled` + `pi-spin` on the icon.

---

## 4. Integration Gaps (Contract-Level)

| #   | Symptom                                      | Root cause                         | Fix touches                        |
| --- | -------------------------------------------- | ---------------------------------- | ---------------------------------- |
| 1   | Sort headers do nothing                      | FE doesn't send, BE doesn't accept | Both repos, all three modules      |
| 2   | Page size 10M possible                       | BE doesn't clamp                   | BE only                            |
| 3   | Bad `filter` JSON silently returns full list | BE swallows parse error            | BE only                            |
| 4   | Org delete shows error mid-flow              | BE doesn't return `canDelete`      | BE returns flag, FE reads it       |
| 5   | Status pill drift between pages              | Per-page templates                 | FE only — extract shared component |
| 6   | "Never logged in" string vs i18n             | Inconsistent template              | FE only                            |
| 7   | No applied-filter chips                      | Not yet implemented                | FE only                            |

---

## 5. Recommended Fix Order (Priority Stack)

**P0 — Sorting end-to-end across all three modules**

- BE: accept `sortBy` + `sortOrder` with per-entity column whitelist + 400 on invalid
- FE: add `pSortableColumn` to sortable headers, wire params into service call
- One commit per module is fine; one PR is fine if the diff stays under ~400 lines

**P1 — Backend hardening**

- Clamp `limit` server-side
- Return 400 on `filter` parse failure
- Add `canDelete` to org list response
- Shared `applyUserFilter` helper for system-admin + user controllers

**P2 — FE consistency & shared components**

- Extract `<dbe-status-pill>`
- Normalize "never logged in" to i18n
- Applied-filter chips + "Clear all"
- Page-size default from config, not template

**P3 — Polish**

- Fixed-width columns → responsive widths + horizontal scroll
- Truncation ellipsis indicator
- Focus-visible on row links
- Inline action spinners

---

## 6. File Map (For The PR Author)

### Backend (UltraSignal-API)

| Concern                      | File                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| Org list controller          | `src/controllers/organisation/listOrg.ts`                    |
| Org list validation          | `src/middleware/organisation/listOrganisation.validation.ts` |
| Org list route               | `src/routes/org.routes.ts:72-77`                             |
| System-admin list controller | `src/controllers/systemAdmin/listSystemAdmin.ts`             |
| System-admin list validation | `src/middleware/systemAdmin/listSystemAdmin.validation.ts`   |
| System-admin list route      | `src/routes/systemAdmin.routes.ts:76-81`                     |
| User list controller         | `src/controllers/user/listUser.ts`                           |
| User list validation         | `src/middleware/user/listUser.validation.ts`                 |
| User list route              | `src/routes/user.routes.ts:84-92`                            |
| Page-size constants          | `config/config.ts` (`DEFAULT_PAGE`, `MAX_ROW`)               |

### Frontend (UltraSignal-UI)

| Concern                 | File                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Org list component (TS) | `src/app/modules/organisation/components/list-organisation/list-organisation.component.ts`   |
| Org list template       | `src/app/modules/organisation/components/list-organisation/list-organisation.component.html` |
| Org service             | `src/app/modules/organisation/services/organisation.service.ts` (verify exact name)          |
| System-admin list (TS)  | `src/app/modules/system-admin/components/list-system-admin/list-system-admin.component.ts`   |
| System-admin template   | `src/app/modules/system-admin/components/list-system-admin/list-system-admin.component.html` |
| User list (TS)          | `src/app/modules/users/components/list-user/list-user.component.ts`                          |
| User list template      | `src/app/modules/users/components/list-user/list-user.component.html`                        |

---

## 7. What Comes Next

This document is the analysis layer. The next step (if you green-light) is to write a sequenced implementation plan per the P0 → P3 stack above — likely starting with sorting on the org list as the pilot, since it's the smallest of the three controllers and serves as the template for the other two.
