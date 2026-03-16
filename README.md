# DalkkakAI — 개발 시작 가이드

> 개발자든 비개발자든 이 문서 하나로 시작할 수 있습니다.
> 터미널을 한 번도 안 써봤어도 괜찮습니다. 그냥 따라하세요.

---

## 딱 두 가지만 설치하면 됩니다

### 1. Docker Desktop

AI 에이전트, 데이터베이스, 서버가 전부 Docker 안에서 돌아갑니다.
PostgreSQL 따로 설치? 필요 없습니다. 전부 자동입니다.

**[Docker Desktop 다운로드 →](https://www.docker.com/products/docker-desktop)**

- Windows: 다운로드 → 설치 → 재시작
- 설치 후 Docker 아이콘(🐋)이 작업표시줄에 보이면 완료

---

### 2. Git

코드 버전 관리에 필요합니다.

**[Git 다운로드 →](https://git-scm.com/downloads)**

- Windows: 다운로드 → "Next" 계속 클릭 → 설치 완료

---

## 시작하기 (딱 3단계)

### 1단계 — 코드 받기

PowerShell을 열고 아래를 복사+붙여넣기 하세요.

> PowerShell 여는 법: Windows 키 → "PowerShell" 검색 → 실행

```powershell
cd C:\Sources
git clone https://github.com/your-org/dalkkak.git
cd dalkkak
```

---

### 2단계 — 서버 시작

```powershell
docker-compose up
```

처음 실행하면 약 2-3분 걸립니다 (이미지 다운로드).
두 번째부터는 10초 안에 시작됩니다.

아래 메시지가 보이면 성공입니다:

```
✅ DalkkakAI API starting — env=development
✅ Migrations complete
✅ Session queue worker started
```

---

### 3단계 — 확인

브라우저에서 열어보세요:

| 주소 | 무엇인가 |
|---|---|
| http://localhost:8000/health | 서버 상태 확인 (OK 뜨면 정상) |
| http://localhost:8000/docs | 전체 API 목록 (직접 테스트 가능) |

---

## 개발할 때 자주 쓰는 명령어

```powershell
# 서버 시작
docker-compose up

# 서버 종료
Ctrl + C  →  docker-compose down

# 전체 테스트 자동 실행 (결과 보고 자동 종료)
docker-compose --profile test up --abort-on-container-exit

# DB 초기화 (처음부터 다시 시작)
docker-compose down -v  →  docker-compose up

# 실행 중인 서버 로그 보기
docker-compose logs -f api
```

---

## AI 기능을 쓰고 싶다면 (선택사항)

1. [console.anthropic.com](https://console.anthropic.com) → 계정 만들기 → API Keys → Create Key → 복사
2. 프로젝트 폴더의 `.env` 파일을 메모장으로 열기
3. `ANTHROPIC_API_KEY=` 뒤에 붙여넣기 → 저장
4. `docker-compose down && docker-compose up` 재시작

API 키 없어도 서버, DB, 테스트는 전부 정상 동작합니다.

---

## 기술 스택 (전체 로드맵)

### Phase 1 — 지금 (Month 0-6)

```
Frontend:   Next.js 14 + Tailwind + shadcn/ui  (Vercel)
Backend:    Python FastAPI + LangGraph          (Railway)
Database:   PostgreSQL + Redis                  (Supabase + Upstash)
AI:         Claude API (Haiku / Sonnet / Opus)
```

### Phase 2 — 스케일 (Month 6-12)

성능 병목이 측정되는 시점에 Go로 분리합니다.

```
API Gateway:      Go (Fiber)           ← 40K+ req/sec
WebSocket Hub:    Go (goroutines)      ← 100K+ 동시 연결
Session Manager:  Go (os/exec)         ← 100+ 워크트리 동시 실행
Deploy Service:   Go (net/http)        ← 빠른 Railway API 호출
Monitor Service:  Go (goroutines)      ← 500+ 스타트업 상태 감시

AI Engine:        Python (영구)        ← LangGraph는 Python only
AI Router:        Python (영구)        ← Claude SDK Python-first
Content/Support:  Python (영구)        ← AI 생태계 전부 Python
```

Go ↔ Python 통신: Redis 큐 (Phase 2 초기) → gRPC (스트리밍 필요 시)

---

## 지금 만들어진 것 / 안 만들어진 것

### ✅ 완성 (Backend Phase 1)

| 모듈 | 설명 |
|---|---|
| 인증 (Auth) | 회원가입, 로그인, JWT, 토큰 갱신 |
| 스타트업 CRUD | 생성, 조회, 수정, 삭제 |
| AI 에이전트 엔진 | Claude tool-use loop, 파일 작성, 테스트 실행 |
| 멀티 세션 큐 | Plan별 동시 실행 제한 (Free=1, Starter=2...) |
| Git Worktree 격리 | 세션마다 독립 브랜치, 충돌 없는 병렬 작업 |
| 자동 테스트 | 작업 완료 → pytest 자동 실행 → 결과 스트리밍 |
| 자동 프리뷰 | 테스트 통과 → Docker로 미리보기 URL 자동 생성 |
| 실시간 WebSocket | 진행상황, 파일 변경, 채팅 실시간 스트리밍 |
| AI Cost Router | 비용 최적 모델 자동 선택 (Zero-cost → Haiku → Sonnet → Opus) |
| Docker 자동화 | `docker-compose up` 한 번으로 전체 스택 실행 |

### ⏳ 다음 단계

| 모듈 | 단계 | 설명 |
|---|---|---|
| **프론트엔드** | Day 2 | Next.js 대시보드, 커맨드바, 실시간 UI |
| Deploy 모듈 | Day 3 | Railway API 연동, 자동 배포 |
| Analytics 모듈 | Phase 1 후반 | 메트릭, 매출, 퍼널 |
| Marketing 모듈 | Phase 1 후반 | AI 광고/블로그 생성 |
| Support 모듈 | Phase 1 후반 | AI 티켓 자동 처리 |
| Billing 모듈 | Phase 1 후반 | Stripe 구독 |
| **Go 서비스** | Phase 2 | Gateway, WebSocket, Session Mgr |

---

## 문제가 생겼을 때

**Docker가 안 켜진다**
→ Docker Desktop을 먼저 실행하세요 (작업표시줄에서 🐋 확인)

**포트 충돌 오류 (`port is already in use`)**
```powershell
docker-compose down
docker-compose up
```

**DB 오류 (`connection refused`)**
→ DB가 아직 시작 중입니다. 30초 기다리면 자동으로 해결됩니다.

**완전히 초기화하고 싶을 때**
```powershell
docker-compose down -v
docker-compose up
```
