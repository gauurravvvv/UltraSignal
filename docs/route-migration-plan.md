# Route Migration Plan — Verb-in-URL → REST

Working table for the big-bang migration. Every old route below maps to one new route. The new mount paths are listed under each module section.

Conventions: see `ROUTING.md` at the repo root.

---

## Mount paths

| Old mount in server.ts    | New mount                  |
| ------------------------- | -------------------------- |
| `/api/v1/access`          | `/api/v1/access`           |
| `/api/v1/analyses`        | `/api/v1/analyses`         |
| `/api/v1/analysis-filter` | `/api/v1/analysis-filters` |
| `/api/v1/announcement`    | `/api/v1/announcements`    |
| `/api/v1/audit`           | `/api/v1/audit-logs`       |
| `/api/v1/auth`            | `/api/v1/auth`             |
| `/api/v1/connections`     | `/api/v1/connections`      |
| `/api/v1/dashboard`       | `/api/v1/dashboards`       |
| `/api/v1/dataset`         | `/api/v1/datasets`         |
| `/api/v1/datasource`      | `/api/v1/datasources`      |
| `/api/v1/group`           | `/api/v1/groups`           |
| `/api/v1/home`            | `/api/v1/home`             |
| `/api/v1/org`             | `/api/v1/orgs`             |
| `/api/v1/profile`         | `/api/v1/profile`          |
| `/api/v1/prompt`          | `/api/v1/prompts`          |
| `/api/v1/query`           | `/api/v1/queries`          |
| `/api/v1/query-builder`   | `/api/v1/query-builders`   |
| `/api/v1/rls-rule`        | `/api/v1/rls-rules`        |
| `/api/v1/role`            | `/api/v1/roles`            |
| `/api/v1/search`          | `/api/v1/search`           |
| `/api/v1/section`         | `/api/v1/sections`         |
| `/api/v1/system-admin`    | `/api/v1/system-admins`    |
| `/api/v1/tab`             | `/api/v1/tabs`             |
| `/api/v1/user`            | `/api/v1/users`            |
| `/api/v1/visual`          | `/api/v1/visuals`          |

Singletons (`/auth`, `/home`, `/profile`, `/search`) stay singular — they don't represent a collection.

---

## Per-module route map

### access (DatasourceAccess)

```
GET    /get/:orgId/:connectionId            ->  GET    /:orgId/:connectionId
POST   /grant                               ->  POST   /grant
```

### analyses

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:orgId/:analysisId              ->  GET    /:orgId/:analysisId
PUT    /update                              ->  PUT    /:orgId/:analysisId  (id moves to path)
DELETE /delete/:orgId/:analysisId           ->  DELETE /:orgId/:analysisId
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
GET    /get/fields/:orgId/:analysisId       ->  GET    /:orgId/:analysisId/fields
GET    /bootstrap/:orgId/:analysisId        ->  GET    /:orgId/:analysisId/bootstrap
POST   /run                                 ->  POST   /:orgId/:analysisId/run
POST   /distinct-values/:orgId/:analysisId  ->  POST   /:orgId/:analysisId/distinct-values
```

### analysis-filters

```
POST   /add                                 ->  POST   /
PUT    /update                              ->  PUT    /:filterId           (id moves to path)
DELETE /delete/:orgId/:filterId             ->  DELETE /:orgId/:filterId
GET    /list/:orgId/:analysisId             ->  GET    /:orgId/:analysisId
POST   /values                              ->  POST   /values              (batch action, no resource id — stays as is)
```

### announcements

```
GET    /get                                 ->  GET    /current             (special: returns the active announcement)
GET    /list                                ->  GET    /
GET    /details/:id                         ->  GET    /:id
POST   /add                                 ->  POST   /
PUT    /update/:id                          ->  PUT    /:id
DELETE /delete/:id                          ->  DELETE /:id
POST   /dismiss/:announcementId             ->  POST   /:announcementId/dismiss
```

### audit-logs

```
GET    /list                                ->  GET    /
GET    /login-activity                      ->  GET    /login-activity
GET    /export/logs                         ->  GET    /export
GET    /export/login-activity               ->  GET    /login-activity/export
```

### auth (singleton)

```
POST   /login                                  ->  POST   /login
POST   /logout                                 ->  POST   /logout
POST   /refresh                                ->  POST   /refresh
POST   /generateOTP                            ->  POST   /generate-otp     (kebab-case)
POST   /reset                                  ->  POST   /reset
POST   /set-password                           ->  POST   /set-password
POST   /verify-setup-token                     ->  POST   /verify-setup-token
POST   /resend-setup-link                      ->  POST   /resend-setup-link
POST   /cli/request                            ->  POST   /cli/request
POST   /cli/authorize                          ->  POST   /cli/authorize
POST   /cli/status                             ->  POST   /cli/status
```

### connections

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:orgId/:id                      ->  GET    /:orgId/:id
PUT    /update                              ->  PUT    /:orgId/:id          (id moves to path)
DELETE /delete/:orgId/:id                   ->  DELETE /:orgId/:id
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
```

### dashboards

```
GET    /list                                ->  GET    /
GET    /get/:orgId/:id                      ->  GET    /:orgId/:id
GET    /render/:orgId/:id                   ->  GET    /:orgId/:id/render
POST   /publish                             ->  POST   /:orgId/publish      (orgId scope; id is optional in body for republish)
POST   /run                                 ->  POST   /:orgId/:id/run
POST   /distinct-values/:orgId/:dashboardId ->  POST   /:orgId/:dashboardId/distinct-values
DELETE /delete/:orgId/:id                   ->  DELETE /:orgId/:id
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
```

### datasets

```
POST   /add                                 ->  POST   /
POST   /add/builder                         ->  POST   /from-builder        (alt-construction action)
PUT    /update/builder                      ->  PUT    /:datasetId/from-builder
POST   /add/field                           ->  POST   /:datasetId/fields
POST   /validate/field                      ->  POST   /:datasetId/fields/validate
GET    /list                                ->  GET    /
GET    /get/:orgId/:datasetId               ->  GET    /:orgId/:datasetId
GET    /get/field/:orgId/:datasetId/:fieldId-> GET    /:orgId/:datasetId/fields/:fieldId
PUT    /update                              ->  PUT    /:orgId/:datasetId
PUT    /update/field                        ->  PUT    /:orgId/:datasetId/fields/:fieldId
DELETE /delete/:orgId/:datasetId            ->  DELETE /:orgId/:datasetId
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
DELETE /delete/field/:orgId/:datasetId/:fieldId -> DELETE /:orgId/:datasetId/fields/:fieldId
POST   /run                                 ->  POST   /:datasetId/run      (id needed; goes to path)
POST   /duplicate/:orgId/:datasetId         ->  POST   /:orgId/:datasetId/duplicate
POST   /distinct-values/:orgId/:datasetId   ->  POST   /:orgId/:datasetId/distinct-values
```

### datasources

```
POST   /add                                 ->  POST   /
POST   /validate                            ->  POST   /validate
GET    /list                                ->  GET    /
GET    /get/:orgId/:id                      ->  GET    /:orgId/:id
PUT    /update                              ->  PUT    /:orgId/:id
POST   /delete/:orgId/:id                   ->  DELETE /:orgId/:id          (verb fix)
POST   /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
GET    /schema/list/:orgId/:datasourceId    ->  GET    /:orgId/:datasourceId/schemas
GET    /table/list/:orgId/:datasourceId/:schema  ->  GET /:orgId/:datasourceId/schemas/:schema/tables
GET    /table/columns/list/:orgId/:datasourceId/:schema/:table -> GET /:orgId/:datasourceId/schemas/:schema/tables/:table/columns
POST   /runQuery                            ->  POST   /:orgId/:datasourceId/query   (id moves to path)
GET    /activity/refresh/:orgId/:datasourceId       -> GET  /:orgId/:datasourceId/activity
POST   /activity/cancel-query/:orgId/:datasourceId  -> POST /:orgId/:datasourceId/activity/cancel-query
POST   /activity/terminate/:orgId/:datasourceId     -> POST /:orgId/:datasourceId/activity/terminate
```

### groups

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:orgId/:id                      ->  GET    /:orgId/:id
PUT    /update                              ->  PUT    /:orgId/:id
DELETE /delete/:orgId/:id                   ->  DELETE /:orgId/:id
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
```

### home (singleton-ish)

```
GET    /system-admin/:id                    ->  GET    /system-admin/:id    (no change — already RESTful)
```

### orgs

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:id                             ->  GET    /:id
PUT    /update                              ->  PUT    /:id                 (id moves to path)
DELETE /delete/:id                          ->  DELETE /:id
DELETE /delete/bulk                         ->  POST   /bulk-delete
POST   /refresh-master-db/:id               ->  POST   /:id/refresh-master-db
```

### profile (singleton)

```
GET    /get                                 ->  GET    /
PUT    /change-password                     ->  PUT    /password            (subresource, not action)
PATCH  /locale                              ->  PUT    /locale              (PATCH→PUT for codebase uniformity)
```

### prompts

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:orgId/:promptId                ->  GET    /:orgId/:promptId
PUT    /update                              ->  PUT    /:orgId/:promptId
DELETE /delete/:orgId/:promptId             ->  DELETE /:orgId/:promptId
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
POST   /config                              ->  POST   /:orgId/:promptId/config
GET    /getConfig/:orgId/:promptId          ->  GET    /:orgId/:promptId/config
POST   /getValues                           ->  POST   /:orgId/:promptId/values
PUT    /refreshValues                       ->  POST   /:orgId/:promptId/refresh-values  (verb fix: refresh is not an update)
PUT    /customise                           ->  PUT    /:orgId/:promptId/appearance
GET    /getAppearance/:orgId/:promptId      ->  GET    /:orgId/:promptId/appearance
```

### queries (singleton-ish utility module)

```
POST   /execute                             ->  POST   /execute
POST   /getStructure                        ->  POST   /structure
POST   /export                              ->  POST   /export
```

### query-builders

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:orgId/:queryBuilderId          ->  GET    /:orgId/:queryBuilderId
PUT    /update                              ->  PUT    /:orgId/:queryBuilderId
DELETE /delete/:orgId/:queryBuilderId       ->  DELETE /:orgId/:queryBuilderId
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
GET    /getTabs/:orgId/:queryBuilderId      ->  GET    /:orgId/:queryBuilderId/tabs
POST   /config                              ->  POST   /:orgId/:queryBuilderId/config
GET    /getConfig/:orgId/:queryBuilderId    ->  GET    /:orgId/:queryBuilderId/config
GET    /getStructure/:orgId/:queryBuilderId ->  GET    /:orgId/:queryBuilderId/structure
POST   /execute                             ->  POST   /:orgId/:queryBuilderId/execute
```

### rls-rules

```
POST   /add                                 ->  POST   /
GET    /list/:orgId/:datasetId              ->  GET    /:orgId  (filter by ?datasetId)  *Decision: use ?datasetId query param*
GET    /get/:orgId/:ruleId                  ->  GET    /:orgId/:ruleId
PUT    /update                              ->  PUT    /:orgId/:ruleId
DELETE /delete/:orgId/:ruleId               ->  DELETE /:orgId/:ruleId
```

### roles

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:orgId/:id                      ->  GET    /:orgId/:id
PUT    /update                              ->  PUT    /:orgId/:id
DELETE /delete/:orgId/:id                   ->  DELETE /:orgId/:id
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
GET    /permissions                         ->  GET    /permissions         (catalog endpoint, no resource id)
```

### search (singleton)

```
POST   /global                              ->  POST   /                    (the whole resource is search)
```

### sections

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:orgId/:sectionId               ->  GET    /:orgId/:sectionId
PUT    /update                              ->  PUT    /:orgId/:sectionId
DELETE /delete/:orgId/:sectionId            ->  DELETE /:orgId/:sectionId
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
GET    /getPrompts/:orgId/:queryBuilderId/:tabId/:sectionId  ->  GET /:orgId/:sectionId/prompts?queryBuilderId=&tabId=
```

### system-admins

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /get/:id                             ->  GET    /:id
PUT    /update                              ->  PUT    /:id
DELETE /delete/:id                          ->  DELETE /:id
DELETE /delete/bulk                         ->  POST   /bulk-delete
PUT    /update/password                     ->  PUT    /:id/password
PUT    /unlock/:id                          ->  POST   /:id/unlock          (unlock is an action, not update)
```

### tabs

```
POST   /add                                 ->  POST   /
GET    /list                                ->  GET    /
GET    /listAll                             ->  GET    /?include=disabled   (filter via query param)
GET    /get/:orgId/:tabId                   ->  GET    /:orgId/:tabId
PUT    /update                              ->  PUT    /:orgId/:tabId
DELETE /delete/:orgId/:tabId                ->  DELETE /:orgId/:tabId
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
GET    /getSections/:orgId/:queryBuilderId/:tabId  ->  GET /:orgId/:tabId/sections?queryBuilderId=
```

### users

```
POST   /add                                 ->  POST   /
POST   /bulk-add/validate                   ->  POST   /bulk/validate
POST   /bulk-add/commit                     ->  POST   /bulk/commit
GET    /list                                ->  GET    /
GET    /get/:orgId/:id                      ->  GET    /:orgId/:id
PUT    /update                              ->  PUT    /:orgId/:id
DELETE /delete/:orgId/:id                   ->  DELETE /:orgId/:id
DELETE /delete/bulk/:orgId                  ->  POST   /:orgId/bulk-delete
PUT    /update/password                     ->  PUT    /:orgId/:id/password
PUT    /unlock/:orgId/:id                   ->  POST   /:orgId/:id/unlock   (action, not update)
```

### visuals

```
GET    /list/:orgId/:analysisId             ->  GET    /:orgId/:analysisId
GET    /list-with-config/:orgId/:analysisId ->  GET    /:orgId/:analysisId?include=config
```

---

## Notes

- **Body→path id migrations**: many `PUT /update` and `PUT /update/...` endpoints take `id` in the body. They become `PUT /:id` with the id in the path. Both the BE controller AND the FE service need updating in lockstep.
- **DELETE /bulk → POST /bulk-delete**: changes both the verb and the path. Two coupled changes per module.
- **Path verbs become subresources or action subpaths**: `/getFoo/:id` becomes `/:id/foo`. `/refreshValues` becomes `/:id/refresh-values`. `/unlock/:id` becomes `/:id/unlock`.
- **PATCH→PUT for /profile/locale**: codebase uniformity. The only PATCH in the API.
