# Frontend API Consumption Guide — Screen Rendering Flow

## Overview

There are **two strategies** to load a screen's UI on the frontend:

### Strategy A — Single API (Full Tree)

One call returns the complete nested structure. Best for screens with a small/medium number of prompts.

```
GET /screen/getStructure/:orgId/:screenId
```

### Strategy B — Lazy Loading (3 sequential calls)

Load incrementally: tabs first, then sections per tab, then prompts per section. Best for large screens or when you want progressive rendering.

```
1. GET /screen/getTabs/:orgId/:screenId
2. GET /tab/getSections/:orgId/:screenId/:tabId
3. GET /section/getPrompts/:orgId/:screenId/:tabId/:sectionId
```

All APIs require a valid JWT token in the `Authorization` header.

---

## Authentication

```
Authorization: Bearer <token>
```

---

# Strategy A — Full Screen Structure (Single Call)

## Request

```
GET /screen/getStructure/:orgId/:screenId
```

| Param      | Type   | Description     |
| ---------- | ------ | --------------- |
| `orgId`    | string | Organisation ID |
| `screenId` | string | Screen ID       |

## Response

```json
{
  "success": true,
  "code": 200,
  "message": "Screen structure retrieved successfully",
  "data": {
    "id": "6",
    "name": "Sales Dashboard",
    "description": "Main sales reporting screen",
    "tabs": [
      {
        "id": "1",
        "name": "Filters",
        "description": "Main filter tab",
        "tabControlName": "filtersTabControl",
        "tabSequence": 1,
        "sections": [
          {
            "id": "10",
            "name": "Date Range",
            "description": "Date selection section",
            "sectionControlName": "dateRangeSectionControl",
            "sectionSequence": 1,
            "prompts": [
              {
                "id": "100",
                "name": "Start Date",
                "description": "Select the start date",
                "type": "date",
                "promptControlName": "startDatePromptControl",
                "mandatory": 1,
                "isGroup": false,
                "groupId": null,
                "validation": { "required": true },
                "promptSequence": 1,
                "config": {
                  "id": "50",
                  "promptId": "100",
                  "prompt_schema": "public",
                  "prompt_table": "",
                  "prompt_column": "",
                  "prompt_join": "",
                  "prompt_where": "",
                  "prompt_sql": "",
                  "prompt_values_sql": "",
                  "appearance": {}
                },
                "values": []
              },
              {
                "id": "101",
                "name": "Region",
                "type": "dropdown",
                "promptControlName": "regionPromptControl",
                "mandatory": 0,
                "promptSequence": 2,
                "config": {
                  "prompt_sql": "SELECT id, name FROM regions WHERE active = 1",
                  "prompt_values_sql": "SELECT id, name FROM regions WHERE active = 1",
                  "appearance": { "width": "half" }
                },
                "values": [
                  { "id": "1", "promptId": "101", "value": "North" },
                  { "id": "2", "promptId": "101", "value": "South" }
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "2",
        "name": "Advanced",
        "tabControlName": "advancedTabControl",
        "tabSequence": 2,
        "sections": []
      }
    ]
  }
}
```

## FE Usage

```ts
async function loadScreen(orgId: string, screenId: string) {
  const { data: screen } = await api.get(
    `/screen/getStructure/${orgId}/${screenId}`,
  );

  // screen.tabs  → sorted by tabSequence
  //   tab.sections  → sorted by sectionSequence
  //     section.prompts  → sorted by promptSequence

  // Render the whole form in one go
  renderScreen(screen);
}
```

---

# Strategy B — Lazy Loading (Sequential Calls)

## Step 1 — Get Tabs for a Screen

### Request

```
GET /screen/getTabs/:orgId/:screenId
```

| Param      | Type   | Description     |
| ---------- | ------ | --------------- |
| `orgId`    | string | Organisation ID |
| `screenId` | string | Screen ID       |

### Response

```json
{
  "success": true,
  "code": 200,
  "message": "Screen tabs retrieved successfully",
  "data": [
    {
      "id": "1",
      "name": "Filters",
      "description": "Main filter tab",
      "tabControlName": "filtersTabControl",
      "databaseId": 1,
      "databaseName": "prod_db",
      "organisationId": 1,
      "organisationName": "Acme Corp",
      "sequence": 1,
      "status": 1,
      "createdOn": "2024-01-01T00:00:00.000Z",
      "tabSequence": 1
    }
  ]
}
```

**Key fields:**

- `tabSequence` — screen-level ordering (not the global `sequence` on the Tab entity)
- `tabControlName` — use as the form control name / React key

### FE Logic

```ts
const { data: tabs } = await api.get(`/screen/getTabs/${orgId}/${screenId}`);
renderTabs(tabs); // tabs already sorted by tabSequence
fetchSections(tabs[0].id); // auto-select first tab
```

---

## Step 2 — Get Sections for a Tab

### Request

```
GET /tab/getSections/:orgId/:screenId/:tabId
```

| Param      | Type   | Description                            |
| ---------- | ------ | -------------------------------------- |
| `orgId`    | string | Organisation ID                        |
| `screenId` | string | Screen ID (sections are screen-scoped) |
| `tabId`    | string | Tab ID (from Step 1)                   |

### Response

```json
{
  "success": true,
  "code": 200,
  "message": "Tab sections retrieved successfully",
  "data": [
    {
      "id": "10",
      "name": "Date Range",
      "description": "Date selection section",
      "sectionControlName": "dateRangeSectionControl",
      "tabId": "1",
      "tabName": "Filters",
      "databaseId": 1,
      "organisationId": 1,
      "sequence": 1,
      "status": 1,
      "createdOn": "2024-01-01T00:00:00.000Z",
      "sectionSequence": 1
    }
  ]
}
```

### FE Logic

```ts
const { data: sections } = await api.get(
  `/tab/getSections/${orgId}/${screenId}/${tabId}`,
);
// Fetch prompts for each section in parallel
await Promise.all(sections.map(s => fetchPrompts(s.id)));
```

---

## Step 3 — Get Prompts for a Section

### Request

```
GET /section/getPrompts/:orgId/:screenId/:tabId/:sectionId
```

| Param       | Type   | Description              |
| ----------- | ------ | ------------------------ |
| `orgId`     | string | Organisation ID          |
| `screenId`  | string | Screen ID                |
| `tabId`     | string | Tab ID                   |
| `sectionId` | string | Section ID (from Step 2) |

### Response

```json
{
  "success": true,
  "code": 200,
  "message": "Section prompts retrieved successfully",
  "data": [
    {
      "id": "100",
      "name": "Start Date",
      "type": "date",
      "promptControlName": "startDatePromptControl",
      "mandatory": 1,
      "isGroup": false,
      "groupId": null,
      "validation": { "required": true },
      "promptSequence": 1,
      "config": {
        "prompt_schema": "public",
        "prompt_table": "",
        "prompt_column": "",
        "prompt_join": "",
        "prompt_where": "",
        "prompt_sql": "",
        "prompt_values_sql": "",
        "appearance": {}
      },
      "values": []
    }
  ]
}
```

---

# Prompt Types Reference

| `type`        | Component               | Uses `values` | Uses `config.prompt_sql` |
| ------------- | ----------------------- | :-----------: | :----------------------: |
| `text`        | `<input type="text">`   |      No       |            No            |
| `number`      | `<input type="number">` |      No       |            No            |
| `date`        | Date picker             |      No       |            No            |
| `daterange`   | Date range picker       |      No       |            No            |
| `calendar`    | Calendar picker         |      No       |            No            |
| `dropdown`    | `<select>` / Dropdown   |      Yes      |      Yes (dynamic)       |
| `multiselect` | Multi-select dropdown   |      Yes      |      Yes (dynamic)       |
| `radio`       | Radio button group      |      Yes      |      Yes (dynamic)       |
| `checkbox`    | Checkbox group          |      Yes      |      Yes (dynamic)       |
| `rangeslider` | Range slider            |      No       |            No            |

### Option Loading Strategy for Dynamic Prompts

For `dropdown`, `multiselect`, `radio`, `checkbox`:

```ts
function getOptions(prompt) {
  // Priority 1: dynamic SQL via config (executed server-side)
  if (prompt.config?.prompt_values_sql) {
    return fetchDynamicOptions(prompt.config.prompt_values_sql);
  }
  // Priority 2: static values list
  if (prompt.values?.length > 0) {
    return prompt.values.map(v => ({ label: v.value, value: v.value }));
  }
  return [];
}
```

---

# Key Fields Glossary

| Field                | Source Entity   | Description                                                               |
| -------------------- | --------------- | ------------------------------------------------------------------------- |
| `tabSequence`        | `ScreenPrompts` | Tab order within this screen                                              |
| `sectionSequence`    | `ScreenPrompts` | Section order within this screen+tab                                      |
| `promptSequence`     | `ScreenPrompts` | Prompt order within this screen+tab+section                               |
| `tabControlName`     | `Tab`           | Auto-generated camelCase form key (e.g. `filtersTabControl`)              |
| `sectionControlName` | `Section`       | Auto-generated camelCase form key (e.g. `dateRangeSectionControl`)        |
| `promptControlName`  | `Prompt`        | Auto-generated camelCase form key (e.g. `startDatePromptControl`)         |
| `mandatory`          | `Prompt`        | `1` = required, `0` = optional                                            |
| `isGroup`            | `Prompt`        | Whether this prompt belongs to a visual group                             |
| `groupId`            | `Prompt`        | ID to group prompts visually on the same row                              |
| `validation`         | `Prompt`        | JSON rules: `required`, `minLength`, `maxLength`, `pattern`, `min`, `max` |
| `config.appearance`  | `PromptConfig`  | Visual overrides (width, color, etc.)                                     |

---

# Tab Switch Behaviour

When the user switches tabs:

- **Strategy A**: No API call needed — data is already in memory. Just swap the active tab.
- **Strategy B**: Only Steps 2 + 3 re-run.

```ts
async function onTabChange(tabId: string) {
  clearCurrentSections();
  await loadTabSections(orgId, screenId, tabId);
}
```

---

# Error Responses

All endpoints return the same error shape:

```json
{
  "success": false,
  "code": 404,
  "message": "Screen not found."
}
```

| HTTP Code | Scenario                                                   |
| --------- | ---------------------------------------------------------- |
| `404`     | Screen / Tab / Section not found, or no active items exist |
| `500`     | Server error                                               |

---

# Sequence Diagram

```
Screen load
│
├─── Strategy A (single call):
│    GET /screen/getStructure/:orgId/:screenId
│    └── returns { screen, tabs[ sections[ prompts[] ] ] }
│
├─── Strategy B (lazy loading):
│    │
│    ├── GET /screen/getTabs/:orgId/:screenId
│    │     └── returns tabs[] sorted by tabSequence
│    │
│    ├── [auto-select tab[0]]
│    │
│    ├── GET /tab/getSections/:orgId/:screenId/:tabId
│    │     └── returns sections[] sorted by sectionSequence
│    │
│    └── for each section (parallel):
│          GET /section/getPrompts/:orgId/:screenId/:tabId/:sectionId
│                └── returns prompts[] sorted by promptSequence
│                      each prompt includes:
│                        - type (drives component)
│                        - validation rules
│                        - config (SQL + appearance)
│                        - values (static options)
```
