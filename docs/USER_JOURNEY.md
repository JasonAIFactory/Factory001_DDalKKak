# DalkkakAI — User Journey Flow

> The complete flow from "I have an idea" to "my startup is running"

---

## Overview

```
아이디어 → 회원가입 → 스타트업 생성 → AI 세션 → 코드 생성 → 테스트 → 배포 → 운영
   1          2           3            4          5          6        7        8
```

---

## Step 1 — Landing Page

```
유저가 dalkkak.ai 접속
→ "아이디어만 말하면 AI가 만들어드립니다"
→ CTA: "무료로 시작하기"
→ 회원가입 페이지로 이동
```

## Step 2 — Sign Up / Login

```
이메일 + 비밀번호 입력
→ JWT 토큰 발급
→ 대시보드로 리다이렉트
```

## Step 3 — Create Startup

```
대시보드 → "새 스타트업 만들기"
→ 이름: "커피 구독 서비스"
→ 설명: "월 정기 구독으로 커피 원두를 배송하는 서비스"
→ 생성 클릭

백엔드:
  → DB에 startup 레코드 생성
  → /workspace/{startup_id}/ 에 git repo 초기화
  → 빈 main 브랜치 + init 커밋
```

## Step 4 — Create Sessions (Parallel AI Work)

```
스타트업 상세 페이지 → "세션 추가"

모드 선택:
┌─────────────────────────────────────┐
│  Auto AI (자동)                      │
│  → 설명 입력하면 AI가 알아서 개발     │
│  → API 토큰 비용 발생                │
│                                      │
│  Terminal (수동)                      │
│  → 웹 터미널에서 Claude Code 직접 사용│
│  → Max 플랜 = 무료                   │
└─────────────────────────────────────┘

세션 생성 시:
  → git worktree 생성 (독립 브랜치 + 폴더)
  → Auto AI: 큐 등록 → executor 자동 실행
  → Terminal: 즉시 running 상태 → 유저가 직접 작업
```

### Session Grid (tmux-style)

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Auth Module      │ Payment Module   │ Frontend         │
│ ● Running        │ ● Running        │ ○ Queued         │
│ ████████░░ 80%   │ ████░░░░░░ 40%   │ ░░░░░░░░░░ 0%   │
│ 5 files          │ 3 files          │                  │
│ $0.25            │ $0.15            │                  │
│ [Test] [Pause]   │ [Test] [Pause]   │ [Start]          │
└─────────────────┴─────────────────┴─────────────────┘
```

## Step 5 — AI Generates Code

### Auto AI Mode:
```
Executor loop:
  1. Claude reads session description
  2. Lists existing files (understand project)
  3. Writes code files (one at a time)
  4. Runs tests (pytest / jest)
  5. Fixes failures
  6. Calls session_complete
  → All actions broadcast via WebSocket (live UI updates)
```

### Terminal Mode:
```
유저가 웹 터미널에서:
  $ claude
  > "Create Express server with login page"
  → Claude Code가 코드 생성
  → 파일이 worktree에 저장됨
  → Files 탭에서 바로 확인 가능
```

### Chat Follow-up (Auto AI):
```
세션 완료 후 Chat 탭에서:
  "로그인 페이지에 Google OAuth 추가해줘"
  → executor 재실행
  → 기존 코드 위에 추가 개발
  → 완료 후 다시 review 상태
```

## Step 6 — Test

```
세션 카드 → "Test" 버튼 클릭

백엔드:
  → _detect_startup_type() (package.json → Node.js, main.py → FastAPI)
  → _find_free_port() (OS가 빈 포트 자동 할당)
  → docker run --detach --publish {port}:{app_port} --volume {worktree}:/app
  → npm install && npm start (또는 uvicorn)
  → preview_url 저장 → UI에 표시

유저:
  → "Open App" 링크 클릭
  → 새 탭에서 실제 앱 확인
  → 코드 수정하면 hot-reload로 자동 반영
```

## Step 7 — Review & Merge

```
세션 상태: review (AI 완료) 또는 유저가 직접 완료 선언

유저가 확인:
  → Files 탭: 생성된 코드 확인
  → Diff 탭: 변경 사항 확인
  → Test: 앱 동작 확인

판단:
  → "Approve" → 승인
  → "Request Changes" → Chat으로 수정 지시 → AI 재작업

승인 후:
  → "Merge" 버튼
  → git merge session-branch → main
  → worktree 정리
  → 세션 상태: completed
```

### Merge Order (SESSION_RULES.md):
```
1. Core (auth, models, config) — 먼저
2. Features (projects, agents) — 다음
3. Frontend — 마지막
→ 통합 테스트 → 실패 시 rollback
```

## Step 8 — Deploy & Operate

```
모든 세션 merge 완료 → main 브랜치에 전체 코드

"Deploy" 버튼:
  → Railway/Vercel에 자동 배포
  → 커스텀 도메인 연결
  → SSL 자동 설정
  → 프로덕션 URL 생성

운영:
  → Monitoring: 업타임, 응답시간, 에러율
  → Analytics: 방문자, 매출, 전환율
  → Support: AI 자동 응답 (RAG)
  → Marketing: 랜딩페이지, SEO, 이메일
  → Billing: Stripe 결제 연동
```

---

## Flow Diagram

```
[Landing Page]
      │
      ▼
[Sign Up / Login]
      │
      ▼
[Dashboard] ←──────────────────────────────┐
      │                                     │
      ▼                                     │
[Create Startup]                            │
      │                                     │
      ▼                                     │
[Create Sessions] ──→ [Auto AI] ──→ [AI Executor Loop]
      │                                     │
      │               [Terminal] ──→ [Claude Code in browser]
      │                                     │
      ▼                                     ▼
[Session Grid] ◄──── [WebSocket live updates]
      │
      ▼
[Test Button] ──→ [Docker Preview] ──→ [Open App in browser]
      │
      ▼
[Review] ──→ [Approve] ──→ [Merge to main]
      │                          │
      │   [Request Changes]      │
      │         │                │
      │         ▼                │
      │   [Chat → AI re-run]    │
      │         │                │
      └─────────┘                │
                                 ▼
                          [Deploy] ──→ [Production URL]
                                 │
                                 ▼
                          [Operate]
                          ├── Monitoring
                          ├── Analytics
                          ├── Support (AI)
                          ├── Marketing (AI)
                          └── Billing (Stripe)
```

---

## Two Modes Comparison

| | Auto AI | Terminal |
|---|---|---|
| 대상 | 비개발자 | 개발자 |
| 작업 방식 | 설명 입력 → AI 자동 | Claude Code 직접 사용 |
| 비용 | API 토큰 (~$0.25/세션) | Max 플랜 = $0 |
| 속도 | 빠름 (자동) | 유저 속도 |
| 제어 | 낮음 (AI 판단) | 높음 (직접 제어) |
| 추가 지시 | Chat 탭 | 터미널에서 직접 |
| 코드 위치 | worktree (동일) | worktree (동일) |
| Test 버튼 | 동일 | 동일 |
| Merge | 동일 | 동일 |
