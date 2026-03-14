# Stage 17 — External Deal Summary Safe Read Surface

## 1. STATUS
PLANNING COMPLETE

## 2. FILES REVIEWED
| Файл | Назначение |
|---|---|
| `src/app/(external)/portal/page.tsx` | Текущий портал — admin client, external_access resolve, документы |
| `src/app/(external)/layout.tsx` | Layout внешнего портала — auth guard |
| `src/app/(external)/portal/external-download-button.tsx` | Скачивание |
| `src/actions/external-document.ts` | Внешний download action |
| `supabase/migrations/20260309143600_stage_2_crm_schema.sql` | Схема deals |
| `supabase/migrations/20260314180000_stage_15a_external_access_isolation.sql` | Trust model |
| `src/app/(protected)/deal/page.tsx` | Seller-side: какие поля используются |

## 3. CURRENT BASELINE SUMMARY

### External Portal Flow
1. `layout.tsx` — auth guard, redirect to `/login` if no user
2. `portal/page.tsx` — `createAdminClient()` reads `external_access` for `user.id`
3. 0 grants → «Нет активного доступа»
4. >1 grants → «Множественный доступ» (MVP block)
5. 1 grant → fetch documents where `is_external = true` via admin client
6. Render documents table + external download button

**Ключевой факт:** портал уже использует `createAdminClient()` для чтения. Добавление deals read через тот же admin client — естественный минимальный delta.

**Текущие deals queries в (external):** NONE — `grep -R "from('deals')" src/app/(external)` → 0 matches.

### Deals Table Schema
```sql
create table public.deals (
  id uuid primary key,
  organization_id uuid references organizations(id),
  name text not null,
  description text,
  target_industry text,
  created_at timestamptz,
  updated_at timestamptz
);
```
Всего 7 полей. Из них safe для MVP external display: `name`, `description`, `target_industry`.

## 4. OPTIONS ANALYZED

### OPTION 1 — NEW EXTERNAL RLS SELECT ON deals
- Добавить RLS policy: external users с `external_access` могут SELECT на deals
- **Плюсы:** стандартный RLS path
- **Минусы:**
  - Расширяет external trust boundary на deals table
  - Требует новую миграцию с RLS policy
  - External RLS SELECT отдаёт все columns → нужен ещё column-level restriction или view
  - Нарушает принцип «не расширять external SELECT scope без явного planning stage»
- **Решение: ОТКЛОНЁН** — слишком широкий для MVP

### OPTION 2 — SERVER-MEDIATED INLINE ADMIN READ (RECOMMENDED)
- Портал уже использует `createAdminClient()`
- После resolve `grant.deal_id` → inline admin read `deals` с hard-coded field allowlist
- **Плюсы:**
  - Нет новых RLS policies
  - Нет миграций
  - Поля жёстко ограничены server-side
  - Минимальный delta: 1 файл
  - Consistent с текущим portal pattern
- **Минусы:** admin client read — но портал уже его использует
- **Решение: РЕКОМЕНДОВАН**

### OPTION 3 — NO DEAL SUMMARY, DEFER
- Оставить портал document-only
- **Плюсы:** нулевой risk
- **Минусы:** MVP gap — external user видит документы без контекста сделки
- **Решение: ОТКЛОНЁН** — justified functional gap

## 5. RECOMMENDED DIRECTION

> **OPTION 2 — SERVER-MEDIATED INLINE ADMIN READ**

Портал уже использует admin client. После resolve `grant.deal_id` добавить:
```
admin.from('deals').select('name, description, target_industry').eq('id', grant.deal_id).single()
```
Рендер: summary card над документами.

**Обоснование выбора 1-file delta вместо 2-file:**
Отдельный `src/actions/external-deal.ts` action file не нужен, потому что:
- portal page уже имеет `grant.deal_id` после access resolve
- admin client уже создан в том же scope
- inline read одной строки — проще и безопаснее чем отдельный action
- Нет client-side вызова → server action не нужен

## 6. LOCKED SAFE FIELD ALLOWLIST

| Поле | Классификация | Обоснование |
|---|---|---|
| `name` | ✅ SAFE FOR MVP | Название сделки — public-safe context |
| `description` | ✅ SAFE FOR MVP | Описание — public-safe context |
| `target_industry` | ✅ SAFE FOR MVP | Целевая отрасль — public-safe context |
| `id` | ❌ INTERNAL ONLY | UUID — не нужен в UI |
| `organization_id` | ❌ INTERNAL ONLY | Привязка к организации — CRM internal |
| `created_at` | ⏳ DEFERRED | Дата создания — потенциально safe, но не MVP |
| `updated_at` | ❌ INTERNAL ONLY | Internal audit field |

**Locked MVP allowlist:** `name`, `description`, `target_industry`

## 7. LOCKED FUTURE EXECUTION SCOPE

### 1-file delta

| Файл | Тип | Изменение |
|---|---|---|
| `src/app/(external)/portal/page.tsx` | MODIFY | Inline admin read + summary card |

### Порядок изменений внутри файла
1. После `const grant = grants[0]` (L70): inline admin read deals с allowlisted fields
2. Перед documents table (L87): summary card с deal info
3. Fail-closed: если deals read fails → summary card не рендерится, документы остаются

### Untouched
- `external-document.ts` — не трогать
- `external-invite.ts` — не трогать
- `external-download-button.tsx` — не трогать
- `layout.tsx` — не трогать
- Все `(protected)/*` — не трогать
- Все миграции — не трогать

## 8. UI SHAPE (LOCKED)

### Summary Card
Над документами, simple read-only card:
```
┌─────────────────────────────────────────────────┐
│  <h2>  {deal.name}                              │
│  <p>   {deal.description}                       │
│  <span> Отрасль: {deal.target_industry}         │
└─────────────────────────────────────────────────┘
```

### Russian UI Text
| Element | Text |
|---|---|
| Отрасль label | «Отрасль:» |
| Missing description | *(не отображать)* |
| Missing target_industry | *(не отображать)* |

### Empty / Error / Access States (LOCKED)
| Состояние | Поведение |
|---|---|
| Deals read succeeds | Summary card + documents table |
| Deals read fails | Summary card не рендерится, documents table рендерится (fail-closed, partial) |
| Deal not found | Summary card не рендерится |
| No description | Description строка не рендерится |
| No target_industry | Industry строка не рендерится |
| 0 grants / >1 grants | Handled by existing logic (L40-67), summary not reached |

**Ключевое решение:** summary и documents fail Independent. Documents table продолжает работать если deals read fails.

## 9. SECURITY / TRUST CHECK

1. **Не создаёт новых RLS policies** — admin client обходит RLS, но он уже используется в этом файле
2. **Не expose CRM data** — only name/description/target_industry, hard-coded allowlist
3. **Не expose organization_id** — not in select
4. **Не expose internal IDs** — not rendered
5. **Не require deal_members** — external user authorized via external_access grant
6. **Не require getCurrentUserActiveDealContext** — stays within external access model
7. **Не change portal trust semantics** — same admin client pattern already established

## 10. OUT-OF-SCOPE
- New migrations
- New RLS policies
- Deal summary editing
- Messaging / offers / communications
- Pipeline / buyer / tasks / AI exposure
- Analytics
- Seller-side page changes
- Portal redesign / tabs / new routes
- Changes to external-document.ts
- Bulk operations

## 11. RISKS / BLOCKERS
None identified. All prerequisites met:
- Admin client already in use
- Deals table schema confirmed
- Safe field allowlist is narrow
- 1-file delta is minimal

## 12. ACCEPTANCE CRITERIA FOR STAGE 17 EXECUTION

1. portal/page.tsx reads `name, description, target_industry` from deals via admin client
2. Summary card renders above documents table
3. Deal name is shown
4. Description shown only if present
5. Target industry shown only if present
6. Summary card does NOT render if deals read fails
7. Documents table still renders if deals read fails
8. No new files created
9. No migrations
10. No RLS changes
11. No changes to external-document.ts / external-invite.ts
12. No seller-side file changes
13. `npm run build` passes

## 13. NEXT RECOMMENDED AG FILE
```
STAGE 17 EXECUTION — EXTERNAL DEAL SUMMARY SAFE READ SURFACE
```
