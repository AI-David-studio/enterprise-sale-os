# Этап 11: Фундамент документов (Documents Foundation)

## 1. Название этапа
Stage 11: Documents Foundation (Хранилище документов: загрузка + листинг)

## 2. Назначение
Первый рабочий модуль документооборота: реальная загрузка файлов в Supabase Storage (`vault` bucket) с метаданными в таблице `documents`, а также рабочий просмотр/скачивание существующих документов. Без продвинутой документной аналитики, ИИ-обзоров, версионирования и buyer-portal поведения.

## 3. Почему Stage 11 идёт после Stage 10
Stage 10 закрепил операционный журнал (задачи + коммуникации). Документы — следующий логичный уровень: физическое файловое хранилище привязанное к сделке. Все зависимости выполнены:
- Stage 8 RLS: документные политики уже настроены
- Stage 9: CRM-мутации работают
- Stage 10: задачи и коммуникации работают
- Storage bucket `vault` уже создан в Stage 3

## 4. Аудит текущей поверхности `/documents`

### Текущее состояние:
- **Листинг**: Реально читает данные из `documents` через `.select('*').eq('deal_id', activeDealId)` ✅
- **Кнопка «Загрузить файл»**: `disabled`, placeholder ❌
- **Кнопка «Скачать»**: `disabled`, placeholder ❌
- **ИИ «Сгенерировать резюме»**: Инлайн-вызов `requestAISummarization()` — НЕ в скоупе Stage 11
- **Колонки таблицы**: Название, Категория, Дата загрузки, Действия
- **Нет role gating**: Страница не использует `getCurrentUserActiveDealContext` — нужно добавить
- **Нет context-based deal resolution**: Используется `supabase.from('deals').select('id').limit(1)` вместо `ctx.dealId`

### Dashboard:
- Нет счётчика документов (в отличие от задач и ИИ-черновиков)
- Нет документов в ленте активности

## 5. Аудит модели данных `documents`

```sql
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  name text not null,
  category text,                -- опционально
  storage_path text not null,   -- путь внутри bucket 'vault'
  uploaded_by uuid references public.users(id) on delete restrict not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

**Ключевые факты:**
- `deal_id` — обязательное, привязка к сделке
- `storage_path` — `NOT NULL`, предполагает реальный файл в Supabase Storage
- `uploaded_by` — обязательное, FK на `users`
- `category` — опциональное (`text`), простая группировка
- Нет поля `buyer_id` — документы привязаны только к сделке, не к покупателям
- Нет полей `mime_type`, `size`, `file_extension` — только `name` и `storage_path`

## 6. Аудит Storage / File Handling

### Supabase Storage:
- **Bucket `vault`** создан в Stage 3 migration: `insert into storage.buckets (id, name, public) values ('vault', 'vault', false)`
- Private bucket (не публичный)
- **Storage RLS:**
  - SELECT: `auth.role() = 'authenticated'`
  - INSERT: `auth.role() = 'authenticated'`
  - Нет UPDATE/DELETE policies на `storage.objects`
- **Код в `src/`**: Ноль вызовов `.storage.` — ни загрузки, ни скачивания, ни signed URL

### Вывод:
Stage 11 **МОЖЕТ** включить реальную загрузку файлов. Bucket существует, storage policies разрешают INSERT/SELECT для аутентифицированных пользователей. Нужно написать upload логику в Server Action и download через signed URL.

### Модель безопасности Storage (ОБЯЗАТЕЛЬНО):
- **Все обращения к Supabase Storage (`vault`) ДОЛЖНЫ выполняться ТОЛЬКО на сервере** — внутри Server Actions.
- Строго запрещено: клиентский вызов `.storage.from('vault').upload(...)`, `.storage.from('vault').download(...)`, или `createSignedUrl()` на клиенте.
- Авторизация загрузки/скачивания проверяется СНАЧАЛА в логике Server Action (role check + same-deal check), и только потом выполняется обращение к Storage API.
- Stage 8 RLS на таблице `documents` защищает метаданные.
- Текущие Storage Object policies (`auth.role() = 'authenticated'`) — грубый инфраструктурный базовый уровень, НЕ бизнес-авторизация. Бизнес-авторизация реализуется в Server Action. Это остаточное ограничение, документируемое честно.

## 7. Границы Stage 8 RLS для документов

| Операция | lead_advisor | advisor | viewer |
|----------|-------------|---------|--------|
| SELECT   | ✅          | ✅      | ✅     |
| INSERT   | ✅          | ✅      | ❌     |
| UPDATE   | ✅          | ✅      | ❌     |
| DELETE   | ✅          | ✅      | ❌     |

## 8. Скоуп Stage 11 (In-Scope)

### 8.1 Загрузка документов
- Создать Server Action `uploadDocumentAction(formData)`.
  - **Контракт входа**: ровно один файл (`File`) за вызов. Файл должен быть непустым (size > 0). Максимум — разумный лимит (например, 50 MB).
  - `name`: опционально. Если не передано — используется оригинальное имя файла (`file.name`).
  - `category`: опционально.
  - `deal_id` и `uploaded_by` определяются серверно из контекста.
  - Роли: только `lead_advisor` и `advisor`.
  - **Генерация `storage_path` (сервер-side only)**:
    1. Корень пути: `{deal_id}/`
    2. Уникальный префикс: UUID (через `crypto.randomUUID()` или аналог)
    3. Оригинальное имя файла ДОЛЖНО быть санитизировано: удалить path-separators (`/`, `\`), управляющие символы, и привести к безопасной подстроке.
    4. Финальный формат: `{deal_id}/{uuid}_{sanitized_filename}`
    5. Запрещено доверять сырому имени файла от клиента как части пути напрямую.
  - **Порядок выполнения (fail-closed)**:
    1. Проверить auth + role + active deal.
    2. Валидировать файл (непустой, один).
    3. Сгенерировать `storage_path` серверно.
    4. Загрузить файл в `vault` bucket: `supabase.storage.from('vault').upload(storagePath, file)`.
    5. Если upload в storage успешен — вставить запись в `documents` (deal_id, name, category, storage_path, uploaded_by).
    6. **Если INSERT в `documents` упадёт** — ОБЯЗАТЕЛЬНО выполнить компенсирующую очистку: `supabase.storage.from('vault').remove([storagePath])`. Логировать и оригинальную ошибку INSERT, и результат очистки (успех или неудача).
    7. Вернуть детерминированный результат: success или error.
  - **Финальный инвариант**: либо Storage-объект + metadata-строка оба существуют, либо Action возвращает ошибку и очистка выполнена (best-effort).

### 8.2 Скачивание документов
- Создать Server Action `getDocumentDownloadUrlAction(formData)`.
  - Принимает: `document_id` (required, UUID).
  - **Порядок выполнения**:
    1. Валидация `document_id` через Zod (UUID).
    2. Resolve current active deal context (`getCurrentUserActiveDealContext`).
    3. Verify текущий пользователь — участник сделки (role не null).
    4. Загрузить документ из `documents` по `id`.
    5. Verify `doc.deal_id === ctx.dealId` (same-deal integrity).
    6. Сгенерировать signed URL: `supabase.storage.from('vault').createSignedUrl(doc.storage_path, 60)` — **TTL строго 60 секунд**.
    7. Вернуть `{ success: true, url: signedUrl }` или `{ success: false, error: '...' }`.
  - Роли: все участники сделки (`lead_advisor`, `advisor`, `viewer`).
  - Запрещено: генерировать signed URL на клиенте, возвращать `storage_path` клиенту, использовать публичные URL.

### 8.3 Страница `/documents`
- **Обязательно**: заменить текущий `supabase.from('deals').select('id').limit(1)` на `getCurrentUserActiveDealContext(user.id)` для resolve deal context.
- Страница доступна для ВСЕХ участников сделки (`lead_advisor`, `advisor`, `viewer`) — это соответствует Stage 8 documents SELECT policy.
- Оживить кнопку «+ Загрузить файл» → реальная форма/модалка с `<input type="file">`. Рендерится ТОЛЬКО для `lead_advisor` и `advisor`.
- Оживить «Скачать» → клиентский компонент вызывает Server Action `getDocumentDownloadUrlAction`, получает signed URL, и открывает его. Доступна для всех ролей.
- `viewer` видит страницу, видит список документов, может скачивать, но НЕ видит кнопку загрузки.
- Добавить pending/error/success состояния для загрузки.

### 8.4 Ревалидация
- После успешной загрузки: `revalidatePath('/documents')` + `revalidatePath('/dashboard')`.

## 9. Вне скоупа Stage 11 (Out-of-Scope)

- DELETE документов
- Редактирование метаданных (name, category) после загрузки
- Версионирование файлов
- Drag-and-drop загрузка
- Bulk upload (множественная загрузка)
- Категории/таксономия (редизайн)
- OCR / парсинг документов
- ИИ-суммаризация / review (уже есть инлайн-заглушка, НЕ трогать)
- Привязка документов к покупателям (нет `buyer_id` в схеме)
- Sharing-ссылки / buyer portal доступ
- Поиск и фильтрация
- Превью содержимого
- Уведомления о новых документах
- Расширение storage policies за пределы текущих
- Клиентские вызовы Storage API (upload/download/signedUrl)
- Dashboard enhancements (счётчик документов и т.д.)

## 10. Инвентарь: Real vs Stub

| Элемент | Текущее состояние | Stage 11 цель |
|---------|-------------------|---------------|
| Листинг документов | ✅ Real | Сохранить, fix deal context |
| Кнопка «Загрузить файл» | ❌ disabled | Оживить |
| File upload → Storage | ❌ Нет кода | Создать |
| Метаданные → documents table | ❌ Нет кода | Создать |
| Кнопка «Скачать» | ❌ disabled | Оживить через signed URL |
| «Сгенерировать резюме» | ✅ Real (AI) | НЕ трогать |
| Role gating на странице | ❌ Нет | Добавить |
| Pending/error состояния | ❌ Нет | Добавить |

## 11. Модель ролей / авторизации

| Действие | lead_advisor | advisor | viewer |
|----------|-------------|---------|--------|
| Просмотр `/documents` | ✅ | ✅ | ✅ |
| Скачать документ | ✅ | ✅ | ✅ |
| Загрузить документ | ✅ | ✅ | ❌ |
| Удалить документ | — | — | — |

**Viewer** может видеть страницу и скачивать документы (read-only). Кнопка «Загрузить файл» НЕ рендерится для viewer. Скачивание для viewer идёт через серверный signed URL (Server Action), НЕ через прямой клиентский Storage API.

Серверные мутации (upload) — обязательная проверка роли на сервере. Stage 8 RLS — fail-closed backstop. Storage Object policies — инфраструктурный базовый уровень, НЕ замена бизнес-авторизации.

## 12. Целевое поведение после выполнения

1. `lead_advisor` или `advisor` может нажать «+ Загрузить файл» → модалка с file input + опциональные name/category → файл загружается в storage → метаданные появляются в списке.
2. Любой участник сделки (`lead_advisor`, `advisor`, `viewer`) может нажать «Скачать» → получает signed URL → файл скачивается.
3. `viewer` видит страницу и может скачивать, но НЕ видит кнопку загрузки.
4. Страница использует `getCurrentUserActiveDealContext` для resolve deal context.
5. **Обязательная ревалидация**: после успешной загрузки — `revalidatePath('/documents')` + `revalidatePath('/dashboard')`.

## 13. Границы выполнения (Execution Boundaries)

### Ожидаемые файлы:
- `src/actions/document.ts` — Server Actions для upload + download URL
- `src/app/(protected)/documents/page.tsx` — обновление страницы
- Минимальные локальные клиентские компоненты в `src/app/(protected)/documents/` при необходимости

### НЕ трогать:
- Миграции, seed.sql, Stage 8 RLS
- Middleware, invite flow, auth flow
- `/deal`, `/buyers`, `/tasks`, `/communications`, `/ai-review`, `/pipeline` logic
- `/dashboard` logic (кроме пассивного `revalidatePath`)
- `requestAISummarization` или любой AI-код на странице `/documents`
- Storage Object policies (не расширять и не модифицировать)
- **Новые глобальные абстракции**: строго запрещено создавать generic uploader frameworks, глобальные progress providers, shared file/storage utilities или shared Storage abstraction layers. Использовать прямые вызовы `supabase.storage.from('vault')` API внутри Server Actions.
- **Dashboard enhancements**: не добавлять счётчик документов или документы в ленту активности в рамках Stage 11.

## 14. Критерии приёмки (Acceptance Criteria)

1. Реализован Server Action для загрузки документа (file + metadata insert). Автоматически привязывается к `deal_id` + `uploaded_by`.
2. Файл реально загружается в Supabase Storage bucket `vault`.
3. `storage_path` записывается в `documents` с детерминированной конвенцией.
4. Реализован Server Action `getDocumentDownloadUrlAction` для получения signed download URL с TTL = 60 секунд.
5. Download URL проверяет, что документ принадлежит текущей сделке (`doc.deal_id === ctx.dealId`) и что пользователь — участник сделки.
6. Если INSERT метаданных упадёт после загрузки в storage — выполняется компенсирующее удаление файла из storage (best-effort).
6. Страница `/documents` использует `getCurrentUserActiveDealContext`.
7. `viewer` видит страницу + скачивает, но НЕ видит кнопку загрузки.
8. `lead_advisor` / `advisor` — могут загружать.
9. Успешная загрузка ревалидирует `/documents` + `/dashboard`.
10. Нет миграций, seed changes, Stage 8 RLS изменений.
11. Нет DELETE / edit / AI / notification scope.

## 15. Условия остановки (Stop Conditions)

- Storage bucket `vault` не существует или не доступен → BLOCKED
- Storage upload/download API недоступен в текущей конфигурации Supabase → BLOCKED
- `storage_path` NOT NULL в схеме означает, что metadata-only запись невозможна → upload ОБЯЗАТЕЛЕН
- Реализация требует миграций или bucket redesign → BLOCKED
- Download через signed URL требует дополнительных storage policies → отдельная оценка

## 16. Рекомендуемый порядок после Stage 11

Stage 12: Pipeline/Deal Status Foundation — оживление pipeline-view и статусной машины сделки.

## 17. Инструкции для исполнителя Stage 11

1. Прочитать этот документ полностью ПЕРЕД началом реализации.
2. Подтвердить наличие bucket `vault` в Supabase.
3. Реализовать Server Actions строго по контракту выше.
4. ВСЕ обращения к Storage API — ТОЛЬКО внутри Server Actions. Клиентский код НЕ должен вызывать Storage API.
5. `storage_path` генерируется ТОЛЬКО на сервере. Сырые имена файлов от клиента — санитизировать.
6. НЕ модифицировать инлайн AI summarization код на странице `/documents`.
7. НЕ создавать generic file uploader frameworks или shared storage abstraction layers.
8. Использовать `supabase.storage.from('vault')` API напрямую внутри Server Action.
9. Для download: использовать `createSignedUrl(storagePath, 60)` — TTL строго 60 секунд.
10. Если INSERT `documents` упал — ОБЯЗАТЕЛЬНО вызвать `.remove([storagePath])` для компенсирующей очистки.
11. Проверить build после реализации.
