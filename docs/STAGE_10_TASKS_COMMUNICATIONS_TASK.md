# Этап 10: Задачи и Коммуникации (Tasks & Communications)

## 1. Название этапа
Stage 10: Tasks & Communications Functionalization (Операционный журнал: задачи и лог коммуникаций).

## 2. Цель этапа
Заменить остающиеся UI-заглушки (`disabled` кнопки «Добавить задачу» и «Добавить запись») на работающие Server Actions. После этапа `lead_advisor` и `advisor` смогут создавать задачи по сделке и логировать коммуникации с покупателями через интерфейс, а также отмечать задачи как выполненные.

## 3. Почему этот этап следует за Этапом 9
На Этапе 9 мы реализовали скелет CRM: редактирование сделки, создание покупателей и перемещение по воронке. Теперь база покупателей существует и работает. Операционные записи (задачи, коммуникации) напрямую зависят от существования покупателей (`communications.buyer_id`) и сделки (`tasks.deal_id`). Без работающего скелета CRM операционный журнал не к чему привязывать.

## 4. Аудит текущего состояния (Current Surface Audit)

### `/tasks` (Задачи)
- **Реально**: Страница читает все задачи из `tasks` по `deal_id`. Отображает список с `title`, `description`, `created_at`, чекбоксом `status === 'completed'`. Ограничение доступа работает: `viewer` редиректится на `/dashboard` (L16-19).
- **Заглушки**:
  - Кнопка `+ Добавить задачу` — `disabled` (L39).
  - Чекбоксы статуса — `disabled` (L53).
  - Нет Server Action для создания задачи.
  - Нет Server Action для переключения статуса.

### `/communications` (История коммуникаций)
- **Реально**: Страница читает все коммуникации для покупателей текущей сделки через `buyers!inner(name)` join + фильтр `buyers.deal_id`. Отображает `type` (бейдж), `buyers.name`, `date`, `content`. Ограничение доступа работает: `viewer` редиректится на `/dashboard` (L16-19).
- **Заглушки**:
  - Кнопка `+ Добавить запись` — `disabled` (L40).
  - Нет Server Action для создания записи.
  - Нет формы/модалки для ввода.

### `/dashboard` (Панель управления)
- **Зависимости**: Показывает:
  - Счётчик `Ожидающие задачи` (L45: `status = 'pending'`, `count: 'exact'`).
  - Панель «Ожидающие задачи» — первые 5 pending задач (L47).
  - Лента «Последняя активность» — объединяет task, communication, ai_output (L62-98).
- **Пассивная совместимость**: Dashboard читает данные. Когда Stage 10 добавит мутации для задач/коммуникаций, dashboard автоматически покажет новые данные при `revalidatePath('/dashboard')`.

## 5. Аудит текущей модели данных (Entity/Data Model Audit)

### `tasks`
Поля (подтверждены по `seed.sql` L152):
- `deal_id` UUID (FK → deals) — **обязательное**
- `created_by` UUID (FK → auth.users) — **обязательное**
- `title` TEXT — **обязательное**
- `description` TEXT — опциональное
- `status` TEXT — значения: `'pending'`, `'completed'` (подтверждено L52, L56, L156-172)

### `communications`
Поля (подтверждены по `seed.sql` L177):
- `buyer_id` UUID (FK → buyers) — **обязательное**
- `logged_by` UUID (FK → auth.users) — **обязательное**
- `type` TEXT — значения из сида: `'Email'`, `'Call'`, `'Meeting'`, `'Note'` (L178-189)
- `content` TEXT — **обязательное**
- `date` TIMESTAMPTZ — **обязательное**

## 6. Модель безопасности Stage 8 (RLS Baseline)
Подтверждено по `20260312180000_stage_8_rls_permission_enforcement.sql`:

| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `tasks` | lead_advisor, advisor | lead_advisor, advisor | lead_advisor, advisor | lead_advisor, advisor |
| `communications` | lead_advisor, advisor | lead_advisor, advisor | lead_advisor, advisor | lead_advisor, advisor |

- **`viewer` заблокирован на уровне БД** для обеих таблиц.
- Обе страницы дополнительно редиректят `viewer` на `/dashboard` на уровне RSC (L17-18 обоих файлов).
- Якорь RLS: `tasks` через `deal_id`, `communications` через `buyer_id → buyers.deal_id`.

## 7. Сущности в фокусе (In-Scope Entities)
- `tasks`: `INSERT` (создание) + `UPDATE` status (переключение pending↔completed).
- `communications`: `INSERT` (создание записи коммуникации).
- `buyers`: только `SELECT` — для выбора покупателя при создании записи коммуникации.

## 8. Включено в охват (In-Scope Pages / Actions)

### 8.1 Задачи (`/tasks`)
- Создать Server Action `createTaskAction(formData)`.
  - Поля: `title` (обязательное), `description` (опционально).
  - `deal_id` и `created_by` определяются серверно из контекста.
  - `status` по умолчанию: `'pending'`.
- Создать Server Action `toggleTaskStatusAction(formData)`.
  - Переключает `status` строго между `'pending'` и `'completed'`. Строго запрещены любые другие значения. Если приходит неизвестный статус — Action должен вернуть ошибку.
  - **Same-Deal Integrity**: Обязательная серверная проверка перед обновлением: целевая задача должна существовать, и её `deal_id` должен совпадать с `ctx.dealId`.
- Оживить кнопку «+ Добавить задачу» — реальная форма/компонент.
- Оживить чекбоксы статуса — реальное переключение.
- Добавить pending/error/success состояния.

### 8.2 Коммуникации (`/communications`)
- Создать Server Action `createCommunicationAction(formData)`.
  - Поля: `buyer_id` (обязательное), `type` (обязательное, строго из: Email/Call/Meeting/Note), `content` (обязательное), `date` (обязательное).
  - **Контракт даты**: UI отправляет `date` как строку из `<input type="datetime-local">` (или подобного нативного инпута). Сервер валидирует её через Zod (например, `z.coerce.date()`) и сохраняет в БД как `TIMESTAMPTZ`. Запрещено изобретать кастомные парсеры дат.
  - **Same-Deal Integrity**: Сервер обязан проверить в БД, что выбранный `buyer_id` принадлежит текущей сделке `ctx.dealId`. Доверять UI-выбору нельзя.
  - `logged_by` определяется серверно из контекста.
- Оживить кнопку «+ Добавить запись» — реальная модалка/форма.
- Добавить pending/error/success состояния.

## 9. За границами охвата (Out-of-Scope)
- **Удаление (DELETE)** задач и коммуникаций — вне рамок для снижения риска.
- **Редактирование (UPDATE)** содержимого задач (title/description) и коммуникаций (content) — вне рамок. Только переключение статуса задачи.
- **Вложения / файлы** — не реализовывать.
- **Отправка email / SMS** — коммуникации — это только **журнал**, не механизм отправки.
- **ИИ-генерация** черновиков коммуникаций — вне рамок (Этап 12).
- **Напоминания / уведомления** — вне рамок.
- **Комментарии / треды** — вне рамок.
- **Фильтрация / сортировка / поиск** — вне рамок (используем текущую сортировку по `created_at` / `date`).
- **Создание / изменение покупателей** (Stage 9 complete, не расширять).
- **Изменение Stage 8 RLS** — запрещено.
- **Миграции / seed.sql** — запрещено.

## 10. Инвентаризация: Заглушки против Реальности

### `/tasks/page.tsx`
| Элемент | Статус | Задача Stage 10 |
|---|---|---|
| Выборка задач `select('*')` | ✅ Реальная | Без изменений |
| Список задач + чекбоксы | ✅ Реальный (read-only) | Оживить чекбоксы |
| Кнопка «+ Добавить задачу» | ❌ `disabled` | Создать форму + action |
| Ограничение доступа `viewer` | ✅ Работает | Без изменений |
| Server Action `createTask` | ❌ Отсутствует | Создать |
| Server Action `toggleStatus` | ❌ Отсутствует | Создать |

### `/communications/page.tsx`
| Элемент | Статус | Задача Stage 10 |
|---|---|---|
| Выборка коммуникаций с buyer join | ✅ Реальная | Без изменений |
| Список записей с type/buyer/date | ✅ Реальный (read-only) | Без изменений |
| Кнопка «+ Добавить запись» | ❌ `disabled` | Создать модалку + action |
| Ограничение доступа `viewer` | ✅ Работает | Без изменений |
| Server Action `createCommunication` | ❌ Отсутствует | Создать |
| Выбор покупателя в форме | ❌ Отсутствует | Добавить (select из buyers) |

## 11. Модель авторизации для Stage 10

Все мутации Stage 10 доступны для **lead_advisor** И **advisor** (в отличие от Stage 9, где доступ только lead_advisor).

Правило: Server Action проверяет, что `ctx.roleName` равен `'lead_advisor'` ИЛИ `'advisor'`. Если пользователь `viewer` или не имеет роли — возврат ошибки авторизации. Stage 8 RLS остаётся fail-closed backstop.

UI: обе страницы уже редиректят `viewer` на `/dashboard`. Кнопки мутации рендерятся только если роль — `lead_advisor` или `advisor`.

## 12. Ожидаемое поведение (Target Behavior)
После завершения Этапа 10:
1. `lead_advisor` или `advisor` может создать задачу с названием и описанием — задача появится в списке со статусом `pending`.
2. `lead_advisor` или `advisor` может кликнуть на чекбокс задачи — статус переключится между `pending` и `completed`, визуально отразится зачёркивание.
3. `lead_advisor` или `advisor` может создать запись коммуникации, выбрав покупателя, тип (Email/Call/Meeting/Note), дату и содержание — запись появится в хронологическом логе.
4. `viewer` не видит страницы `/tasks` и `/communications` (редирект на `/dashboard` уже работает).
5. **Обязательная ревалидация**: В конце каждого успешного Server Action (создание задачи, смена статуса задачи, логирование коммуникации) ДОЛЖЕН вызываться `revalidatePath` для текущей страницы (`/tasks` или `/communications`) **И** `revalidatePath('/dashboard')`. Это гарантирует детерминированное обновление счётчиков и ленты активности.

## 13. Границы выполнения (Execution Boundaries)

### 13.1 Ожидаемые изменения файлов
- `src/actions/task.ts` (NEW) — `createTaskAction`, `toggleTaskStatusAction`
- `src/actions/communication.ts` (NEW) — `createCommunicationAction`
- `src/app/(protected)/tasks/page.tsx` (MODIFY) — вынести форму и чекбоксы в клиентские компоненты
- `src/app/(protected)/communications/page.tsx` (MODIFY) — вынести форму в клиентский компонент
- Небольшие UI-компоненты внутри `tasks/` и `communications/` папок (максимум 2-3 файла).

### 13.2 Запрещено менять
- Миграции, seed.sql, Stage 8 RLS
- Middleware, invite flow, auth flow
- Buyer edit/delete расширение
- `/deal`, `/dashboard` logic (кроме пассивного `revalidatePath`)
- `/ai-review`, `/documents`, `/pipeline`
- **Новые глобальные абстракции**: Строго запрещено создавать Shared Form Components, новые Notification/Toast frameworks или глобальные Context Providers. Использовать только базовые возможности React 19 (`useActionState`) и явную работу с DOM.

## 14. Критерии приемки (Acceptance Criteria)
1. Реализован Server Action для создания задачи (`title`, `description`). Автоматически привязывается к `deal_id` + `created_by`. Статус по умолчанию: `pending`.
2. Реализован Server Action для переключения статуса задачи (`pending` ↔ `completed`).
3. Реализован Server Action для создания записи коммуникации (`buyer_id`, `type`, `content`, `date`). Автоматически привязывается к `logged_by`.
4. Все Server Actions проверяют: роль — `lead_advisor` или `advisor`. `viewer` — ошибка авторизации.
5. Все Actions валидированы через Zod.
6. UI формы имеют pending/error/success состояния.
7. Не добавлены DELETE/UPDATE (кроме status toggle) операции.
8. Stage 8 RLS не изменён.
9. Миграции и seed.sql не изменены.
10. Билд (`npm run build`) проходит чисто.

## 15. Условия остановки (Stop Conditions)
- Остановка, если таблица `tasks` или `communications` не содержит ожидаемых полей в runtime (реальная схема отличается от seed).
- Остановка, если создание коммуникации требует реструктуризации связи `buyer_id` → `deal_id`.
- Остановка, если схема `status` задачи сложнее бинарного `pending`/`completed`.
- Остановка, если реализация требует миграций, изменения middleware или расширения auth flow.

## 16. Рекомендуемый порядок следующих этапов
1. **Этап 11: Documents Foundation** — загрузка/листинг документов через Supabase Storage.
2. **Этап 12: AI Integration** — генерация реальных черновиков с сохранением в `ai_outputs`, кнопки Approve/Reject.
3. **Этап 13: Dashboard Enhancement** — более детальная аналитика, графики воронки, метрики конверсии.

## 17. Инструкции по передаче (Handoff Instructions)
- Этап 10 полностью спроектирован и зафиксирован.
- Следующий вызов должен идти в режиме `EXECUTOR`.
- Имя следующего задания: **"STAGE 10 EXECUTION — Tasks & Communications"**.
- Исполнитель обязан прочитать данный документ-спецификацию как главное руководство.
- **Ключевое отличие от Stage 9**: мутации доступны НЕ ТОЛЬКО `lead_advisor`, но и `advisor`.
