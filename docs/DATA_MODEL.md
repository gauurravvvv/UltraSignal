# Data model: Dataset → Analysis → Dashboard

This is the developer-facing reference for how data flows from the
raw dataset definition through analyses to published dashboards, and
what freezes vs what stays live across each layer.

## The three layers at a glance

```
┌─────────────┐
│   Dataset   │  Mutable. SQL + column list. Single source of truth.
└──────┬──────┘  Editing it propagates LIVE to everything downstream.
       │
       │  many analyses point at one dataset
       │  (via Analyses.datasetId — live reference)
       │
       ▼
┌─────────────┐
│  Analyses   │  Versioned. Each edit spawns a new row.
│  (A1, A2…)  │  Older versions are immutable history.
└──────┬──────┘  listAnalyses shows ONLY the head version per lineage.
       │
       │  one dashboard pins to one analysis version
       │  (via Dashboard.sourceAnalysisId — soft pointer, no FK)
       │
       ▼
┌─────────────┐
│  Dashboard  │  Published snapshot. Pins to a specific analysis
│             │  version. Survives source deletion (renders "source
└─────────────┘  no longer available" instead of disappearing).
```

## What's live vs what's pinned

### Dataset layer — fully live

The dataset is the single source of truth. Anything dataset-level is
read live by every consumer on every request:

- `Dataset.sql` — every analysis run + every dashboard render reads
  the current SQL.
- `Dataset.name` — same.
- Dataset-level `DatasetField` rows (where `analysisId IS NULL`) —
  read live by analyses; consumed by `runAnalysisQuery`.
- `DatasetFieldRelation` edges between dataset-level fields — live.

An edit to `Dataset.sql` (or to a dataset-level custom field) is
visible immediately to every analysis and every dashboard built on
that dataset, no republish required. The `findStaleColumnReferences`
helper scans downstream pinned column references at save time and
returns advisories — the user is not blocked, but they're warned
about which downstream filters/visuals now reference missing columns.

### Analysis layer — versioned

An "analysis" in the UI is really a *chain* of `Analyses` rows. Each
chain is identified by a stable `lineageId` (the first row's own id).
Every row in the chain has a monotonic `versionNumber` (1, 2, 3…).

Editing an analysis NEVER mutates the existing row. The
`updateAnalysis` controller calls `cloneAnalysisVersion`, which
deep-copies every child row (Visual, VisualConfig, AnalysisFilter,
analysis-scoped DatasetField, DatasetFieldRelation) into a fresh
analysis row at `versionNumber + 1`. The user's edits then land on
the new row.

The analyses list (`listAnalyses`) returns ONE row per lineage — the
head (highest versionNumber). To see history, hit:

    GET /api/v1/analyses/:orgId/:analysisId/versions

This returns every row in the same lineage, newest first, with an
`isHead: true` flag on the current head.

#### What's analysis-level (versioned with the analysis)

- `Visual` rows (chart layout positions, sizes)
- `VisualConfig` rows (chart type, axis columns, jsonb config)
- `AnalysisFilter` rows
- `DatasetField` rows where `analysisId = this.id` (analysis-scoped
  custom fields — formulas the user authored against an analysis
  rather than the underlying dataset)
- `DatasetFieldRelation` edges between any pair of analysis-scoped
  fields

These are all deep-copied on edit. A1 keeps its children; A2 starts
with fresh copies that the user's edits then modify.

#### What's dataset-level (NOT versioned)

- `Dataset.sql` / `Dataset.name` — read live through `Analyses.datasetId`.
- Dataset-level `DatasetField` rows — same.

When the user edits the dataset, every analysis version (A1, A2, A3…)
and every dashboard built on any of them immediately reflects the new
SQL output. There's no version per analysis-version pair.

### Dashboard layer — pinned snapshot

A dashboard is created by clicking "Publish" against a specific
analysis version. The dashboard pins to that exact version via
`Dashboard.sourceAnalysisId`. The snapshot helper
(`snapshotAnalysisIntoDashboard`) deep-copies the analysis's
visuals/configs/filters/fields into dashboard-scoped tables:

- `DashboardVisual` + `DashboardVisualConfig`
- `DashboardFilter`
- `DashboardField` + `DashboardFieldRelation`

These are immutable from the dashboard's perspective. If the user
edits A1 and spawns A2, dashboard D1 (pinned to A1) keeps showing the
exact visuals and configs A1 had. To get D2 against A2, the user
explicitly publishes again.

#### What's still live for a dashboard

Despite the snapshot, two things stay live for every render:

1. **Dataset SQL** — `runDashboardQuery` walks
   `Dashboard.sourceAnalysisId → Analyses.datasetId → Dataset.sql`
   and executes the *current* SQL. This means edits to the underlying
   dataset propagate to every dashboard automatically.

2. **Datasource credentials + RLS policy** — connection params and
   RLS rules are read live, scoped to `Dashboard.datasetId`. Credential
   rotation and policy changes affect every dashboard immediately.

This is the hybrid model: **data view = live, layout = frozen.**

## Soft-delete behaviour

Datasets and analyses use soft-delete (`@DeleteDateColumn`). The
policy is "gate at list and view" — every entry-point query hides
rows whose source ancestor has been soft-deleted, so the user
never reaches a render path with a dead source.

Per-entity gates:

- **Analyses list** (`listAnalyses`) — innerJoins `analysis.dataset`
  so an analysis whose parent dataset is soft-deleted disappears
  from the list. TypeORM auto-applies `deletedOn IS NULL` on
  relation-aware joins.
- **Analyses view** (`getAnalysis.validation`) — same innerJoin;
  returns 404 if the dataset is soft-deleted.
- **Dashboard list** (`listDashboard`) — innerJoins via the chain
  `Dashboard.sourceAnalysisId → Analyses.id → Analyses.datasetId
  → Dataset.id` with explicit `deletedOn IS NULL` on each (the
  pointer is a soft FK so TypeORM's auto-filter doesn't apply).
  Dashboards whose analysis OR dataset is soft-deleted are hidden.
- **Dashboard view + render** (`getDashboard.validation`,
  `renderDashboard.validation`) — same chain; returns 404 if any
  ancestor is soft-deleted.
- **Dashboard run + distinct-values** (`runDashboardQuery`,
  `getDistinctDashboardFieldValues`) — same chain enforced in
  the controller's load.

Soft-delete cascade:

- **Soft-delete a dataset** → cascades through
  `cascadeDatasetChildren`: hard-deletes the dataset's fields +
  field relations; soft-deletes every analysis under it. Dashboards
  pointing at those analyses survive in the DB but are hidden
  everywhere a user could reach them, because of the gate-at-
  list-and-view policy above.
- **Soft-delete an analysis** → `cascadeAnalysisChildren`
  hard-deletes its visuals / visual-configs / filters. Dashboards
  pointing at this analysis survive in the DB but are hidden by
  the gate.
- **Restore** (un-setting `deletedOn`) → the dataset / analysis row
  reappears in lists immediately. Children that were hard-deleted
  during the cascade do NOT come back; the analysis comes back
  empty. Dashboards built on the restored analysis become visible
  again because the gate is now clear.

`cascadeAnalysisChildren` and `cascadeDatasetChildren` in
`src/shared/utility/cascadeSoftDelete.ts` deliberately do NOT touch
dashboards. The previous version had a silent-no-op bug here
(referenced a non-existent `Dashboard.analysisId` column); the
current behaviour — survive in the DB, hide from the UI — is the
correct one for snapshot semantics.

## Edge cases

### User renames a dataset column that an analysis filter pins

The dataset save succeeds with no warning. Downstream
`AnalysisFilter.columnName`, `VisualConfig.xAxisColumn`,
`VisualConfig.yAxisColumn`, `DashboardFilter.columnName`,
`DashboardVisualConfig.xAxisColumn/yAxisColumn` that reference the
now-missing column will surface their own runtime errors the next
time the user opens the affected analysis or dashboard ("column does
not exist" from Postgres, propagated through the controller). No
advisory machinery — the user iterates freely on the dataset and
fixes downstream consumers as they encounter them.

### User edits an analysis with two dashboards published from it

Both dashboards point at A1 via `sourceAnalysisId`. The edit spawns
A2 (clone + applied edits). A1 remains in the DB unchanged — both
dashboards render identically to before.

### User deletes a dataset that has analyses + dashboards downstream

The dataset is soft-deleted. Its analyses are soft-deleted (cascade
through `cascadeDatasetChildren`). Visual/VisualConfig/AnalysisFilter
rows owned by those analyses are hard-deleted. Dashboards survive
in the DB but are hidden everywhere a user could reach them — the
list, the view-by-id endpoint, the render endpoint, the run-query
endpoint, and the distinct-values endpoint all gate by joining
`Dashboard → Analyses → Dataset` and excluding any dashboard whose
ancestor is soft-deleted.

Restoring the dataset (un-setting `deletedOn`) immediately
re-surfaces the analyses (their dataset is alive again) and the
dashboards (their full chain is alive again). The hard-deleted
visual/filter rows from the analyses do NOT come back; the
restored analyses come back empty, but the published dashboards
still have their own snapshot rows and render normally.

### User publishes a dashboard from A1, then A2 is spawned

D1's `sourceAnalysisId` stays pointing at A1. The snapshot tables
(`DashboardVisual`, `DashboardFilter`, etc.) hold the state A1 had
at publish time. A2 has its own separate children. D1 is unaffected.

To get D2, the user republishes against A2. The publish controller
loads the analysis by id (A2), captures its children into a new set
of dashboard snapshot rows.

### User edits a custom dataset-level field after a dashboard was published

Dashboard-side custom fields are snapshotted into `DashboardField`
at publish. So renaming a dataset-level custom field after publish
does NOT propagate to the dashboard's snapshot. The dashboard keeps
working with the old field name.

This is intentional. If you want the dashboard to pick up the new
field, republish.

## Key file map

| Concern | File |
|---|---|
| Entity: Dataset | `src/shared/db/shared_entity/dataset.entity.ts` |
| Entity: Analyses (lineageId, versionNumber) | `src/shared/db/shared_entity/analyses.entity.ts` |
| Entity: Visual (sequence) | `src/shared/db/shared_entity/visual.entity.ts` |
| Entity: Dashboard (sourceAnalysisId) | `src/shared/db/shared_entity/dashboard.entity.ts` |
| Helper: clone an analysis into a new version | `src/shared/helpers/analyses/cloneAnalysisVersion.helper.ts` |
| Helper: resolve live dataset SQL for a dashboard | `src/shared/helpers/dashboard/resolveLiveDatasetSql.helper.ts` |
| Helper: scan downstream references for stale columns | `src/shared/helpers/dataset/findStaleColumnReferences.ts` |
| Helper: snapshot an analysis into a dashboard | `src/shared/helpers/dashboard/snapshotAnalysisIntoDashboard.helper.ts` |
| Controller: edit-spawns-new-version | `src/modules/analyses/controllers/updateAnalysis.ts` |
| Controller: head-version-only list | `src/modules/analyses/controllers/listAnalyses.ts` |
| Controller: lineage history | `src/modules/analyses/controllers/listAnalysisVersions.ts` |
| Controller: dashboard run reads live SQL | `src/modules/dashboards/controllers/runDashboardQuery.ts` |
| Cascade soft-delete (dashboards survive) | `src/shared/utility/cascadeSoftDelete.ts` |
