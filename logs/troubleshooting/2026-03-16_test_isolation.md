# 2026-03-16 — Test Isolation Failures (26 tests → all passing)
> Project: DalkkakAI | Bug: All tests failing, returning wrong status codes

---

## Bug 1: passlib + bcrypt incompatibility (409 instead of 201)

**Symptom:** `test_register_success` returned 409 instead of 201
**Root cause:** `passlib 1.7.4` + `bcrypt 5.0.0` incompatible — `hash_password()` threw `ValueError`. Router caught ALL `ValueError` as 409.
**Fix:** Removed passlib, use `bcrypt` directly. Narrowed exception catch to only `"already registered"` ValueError.
**Files:** `backend/auth/service.py`, `backend/auth/router.py`, `requirements.txt`

## Bug 2: SQLite UUID column requires UUID object not string

**Symptom:** `test_me_authenticated` failed with `AttributeError: 'str' object has no attribute 'hex'`
**Root cause:** `get_user_by_id(user_id: str)` passed string to UUID column. PostgreSQL coerces silently; SQLite does not.
**Fix:** `uid = uuid.UUID(user_id)` before query
**Files:** `backend/auth/service.py`

## Bug 3: MissingGreenlet after db.flush()

**Symptom:** `SessionResponse.model_validate(session)` raised `MissingGreenlet` on `updated_at`
**Root cause:** `db.flush()` expires all ORM attributes. Pydantic accesses them synchronously → SQLAlchemy tries async I/O → MissingGreenlet
**Fix:** Add `await db.refresh(session)` before every `model_validate(session)` call
**Files:** `backend/sessions/router.py`, `backend/startups/router.py`

## Bug 4: HTTPException returns `{"detail": ...}` not `{"ok": false, "error": ...}`

**Symptom:** Tests checking `response.json()["ok"]` got `KeyError: 'ok'` on error responses
**Root cause:** FastAPI's default HTTPException handler returns `{"detail": ...}`, not our `{"ok": false}` format
**Fix:** Added custom `@app.exception_handler(HTTPException)` in `main.py`
**Files:** `backend/main.py`

## Bug 5: StaticPool needed for SQLite in-memory test isolation

**Symptom:** Tests sharing SQLite data across test functions (user already exists)
**Root cause:** Without `StaticPool`, SQLAlchemy creates multiple connections to `:memory:` — each gets a different empty DB, but connection reuse across test cleanup can leak
**Fix:** Added `poolclass=StaticPool, connect_args={"check_same_thread": False}` to test engine
**Files:** `tests/conftest.py`

## Bug 6: asyncio.gather concurrent requests share one db_session

**Symptom:** `test_multiple_sessions_queued_in_order` failed with SQLAlchemy concurrency error
**Root cause:** Test fixture provides ONE shared `db_session`. Running 3 requests with `asyncio.gather` = 3 coroutines hitting same session concurrently → `Session.add()` during flush conflict
**Fix:** Changed to sequential `await` calls — tests queue logic, not literal network concurrency
**Files:** `tests/test_sessions.py`

## Result

26/26 tests passing. All endpoint categories covered: auth (10), startups (8), sessions (8).
