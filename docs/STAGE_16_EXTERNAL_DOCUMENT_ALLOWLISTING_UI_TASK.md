# Stage 16 — Seller-Side External Document Allowlisting UI

## 1. ACCEPTED BASELINE CONFIRMED

Stage 15A/15B/15C trust model сохранён полностью:
- `is_external BOOLEAN NOT NULL DEFAULT FALSE` уже существует в `documents` (Stage 15A migration L14)
- External portal фильтрует `.eq('is_external', true)` (portal/page.tsx L77)
- External download action проверяет `doc.is_external` (external-document.ts L81)
- Seller-side documents surface НЕ содержит никаких ссылок на `is_external`
- Все external principals изолированы через `external_access` + RLS

## 2. CURRENT FILE MAP

### Primary Seller-Side Documents Surface
| Файл | Тип | Назначение |
|---|---|---|
| `src/app/(protected)/documents/page.tsx` | Server page | Основная страница документов. `select('*')` уже возвращает `is_external`. |
| `src/app/(protected)/documents/upload-document-form.tsx` | Client component | Модал загрузки. НЕ устанавливает `is_external`. |
| `src/app/(protected)/documents/download-document-button.tsx` | Client component | Кнопка скачивания. |

### Document Actions
| Файл | Действие | Роли |
|---|---|---|
| `src/actions/document.ts` | `uploadDocumentAction` | lead_advisor, advisor |
| `src/actions/document.ts` | `getDocumentDownloadUrlAction` | любой deal member |

### Role Gating
- `documents/page.tsx` L18: `getCurrentUserActiveDealContext(user.id)` → все deal members видят страницу
- `documents/page.tsx` L23: `canUpload = lead_advisor || advisor`
- Upload action L80: `lead_advisor || advisor`
- Download action L209: любая роль

## 3. CURRENT DATA FLOW

### Query
```
documents/page.tsx L26-30:
.from('documents').select('*').eq('deal_id', ctx.dealId).order('created_at', { ascending: false })
```
`select('*')` уже возвращает `is_external` для каждого документа. Дополнительных запросов не нужно.

### Render
Текущая таблица (L54-76) рендерит: name, category, created_at, download + AI summary.
`is_external` не отображается и не используется.

### Upload
`uploadDocumentAction` (L140-146) вставляет: `deal_id, name, category, storage_path, uploaded_by`.
`is_external` НЕ передаётся → default FALSE. Это корректно.

## 4. RECOMMENDED MINIMAL UX

### UI Pattern: Inline Badge + Toggle Button

В таблице документов добавить:
1. **Визуальный badge** в ячейке имени файла, показывающий «Внешний» если `is_external === true`
2. **Кнопку-toggle** в колонке действий для переключения `is_external`

### Расположение
- Badge: рядом с именем файла (L60) — маленький `<span>` зелёный/серый
- Toggle button: в колонке действий (L64-74) — третья кнопка после «Скачать» и «Сгенерировать резюме»

### Russian UI Text
| Состояние | Badge | Button |
|---|---|---|
| `is_external = false` | *(нет badge)* | `Открыть внешний доступ` |
| `is_external = true` | `Внешний` (зелёный badge) | `Закрыть внешний доступ` |
| Toggle in progress | — | `Обновление…` (disabled) |

### Permission Model
| Роль | Видит badge | Может toggle |
|---|---|---|
| lead_advisor | ✅ | ✅ |
| advisor | ✅ | ❌ |
| viewer | ✅ | ❌ |

Обоснование: `is_external` влияет на trust boundary — только lead_advisor должен его менять.

### Что НЕ добавлять
- Модальное подтверждение (избыточно для toggle)
- Bulk toggle (out of scope)
- Колонку «Внешний» как отдельный столбец (badge достаточно)
- Toast notifications (нет в текущем documents flow кроме upload)

## 5. RECOMMENDED FUTURE EXECUTION SCOPE

### Files to Modify (3 files)

| Файл | Изменение |
|---|---|
| `src/actions/document.ts` | **ADD** новый action `toggleDocumentExternalAction(documentId)` — lead_advisor only, same-deal check, toggles `is_external`, revalidates `/documents` |
| `src/app/(protected)/documents/page.tsx` | **MODIFY** — добавить badge рядом с именем, передать `canToggleExternal` и `doc.is_external` в новый toggle component |
| `src/app/(protected)/documents/external-toggle-button.tsx` | **NEW** — client component: inline button вызывает `toggleDocumentExternalAction` |

### Order of Changes
1. Action first (`document.ts` — добавить `toggleDocumentExternalAction`)
2. Client component (`external-toggle-button.tsx`)
3. Page integration (`documents/page.tsx` — badge + button)

### Untouched
- `upload-document-form.tsx` — не трогать
- `download-document-button.tsx` — не трогать
- `external-document.ts` — не трогать
- `external-invite.ts` — не трогать
- Все `(external)/*` файлы — не трогать
- Все миграции — не трогать

## 6. SECURITY / TRUST CHECK

### Почему это не ломает Stage 15A
- `is_external` — существующий столбец, управляемый через обычный `UPDATE` на `documents`
- RLS на `documents` уже позволяет deal members делать SELECT
- UPDATE на `documents` для deal members (lead_advisor) уже разрешён существующими RLS policies
- External portal продолжает фильтровать `is_external = TRUE` — семантика не меняется
- External download action проверяет `is_external` server-side — guard остаётся

### Почему нет CRM leakage
- Toggle меняет только boolean flag, не создаёт новых data paths
- External portal видит только document name + storage path для `is_external = TRUE`
- Buyer metadata, pipeline, communications, tasks не затронуты

### Почему не нужен portal redesign
- Portal уже корректно фильтрует по `is_external` — UI toggle на seller side просто управляет этим флагом

## 7. RISKS / BLOCKERS

### Потенциальный риск: RLS UPDATE policy для documents
Нужно подтвердить, что RLS на `documents` позволяет `UPDATE` для deal members (lead_advisor).
Если UPDATE policy отсутствует → потребуется admin client или новая RLS policy.

> **Рекомендация:** На execution stage первым шагом проверить `grep "documents" migrations` на наличие UPDATE policy. Если нет — использовать admin client с server-side role check (тот же pattern что в upload).

### Нет блокеров уровня «стоп»
- Схема уже содержит `is_external`
- Query уже возвращает `is_external` через `select('*')`
- Не нужны новые миграции
- Не нужны новые RLS policies (если UPDATE разрешён; если нет — admin client решает)

## 8. ACCEPTANCE CRITERIA FOR STAGE 16 EXECUTION

1. `toggleDocumentExternalAction` существует в `document.ts`
2. Action доступен только для lead_advisor
3. Action проверяет same-deal ownership
4. Action toggles `is_external` (true↔false)
5. Action вызывает `revalidatePath('/documents')`
6. `external-toggle-button.tsx` существует
7. Toggle button disabled while pending
8. Badge «Внешний» отображается при `is_external === true`
9. Toggle button видна только lead_advisor
10. Badge видна всем deal members
11. `npm run build` проходит
12. Нет новых миграций
13. Нет изменений в external portal files
14. Нет изменений в `external-invite.ts` / `external-document.ts`
15. `git diff HEAD --name-only` показывает только 3 файла

## 9. DEFERRED ITEMS

| Item | Причина отложки |
|---|---|
| Bulk toggle для нескольких документов | Out of MVP scope |
| Confirmation modal перед toggle | Избыточно для простого toggle |
| «Внешний» как отдельная колонка таблицы | Badge достаточно для MVP |
| Фильтр «только внешние» | Future UX enhancement |
| is_external toggle из upload modal | Усложняет upload flow |
| Audit log для toggle changes | Future compliance feature |

## 10. NEXT RECOMMENDED AG FILE

```
STAGE 16 EXECUTION — SELLER-SIDE EXTERNAL DOCUMENT ALLOWLISTING UI
```
