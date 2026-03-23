# 제품 차별화 핵심 요소
## 2026-03-23

---

### 차별화 #1 — 딸깍 전용 CLAUDE.md (최대 차별점)

**원리:**
스타트업 생성 시 `/workspace/{id}/CLAUDE.md` 자동 생성.
Claude Code가 이 디렉토리에서 실행되면 CLAUDE.md를 자동으로 읽음.
→ 우리 규칙이 Claude Code 동작에 자동 적용.

**규칙 내용:**
1. `dalkkak.json` 필수 생성 (start 명령어 + port)
2. 서버는 0.0.0.0 바인딩 (Docker 네트워킹 필수)
3. `/health` 엔드포인트 필수 (헬스체크용)
4. 환경변수는 .env 파일 사용
5. requirements.txt / package.json 필수

**왜 차별화인가:**
- 다른 서비스 (Devin, Cursor, Codex): 그냥 Claude/GPT 띄워줌
- DalkkakAI: **규약이 내장된** Claude Code를 제공
- 결과물이 항상 Test 버튼으로 실행 가능한 형태로 나옴
- 유저가 규칙을 몰라도 자동으로 "배포 가능한 코드"가 생성됨

**확장 가능성:**
- 플랜별로 다른 CLAUDE.md (Free=기본, Scale=보안+모니터링+성능최적화)
- 도메인별 CLAUDE.md (제조=센서연동규칙, 금융=보안규칙, 의료=HIPAA규칙)
- 유저 커스텀 CLAUDE.md (고급 유저가 자기만의 규칙 추가)

---

### 차별화 #2 — 두 가지 모드 (Terminal + Auto AI)

**Terminal 모드:**
- 유저의 Claude Code/Codex 구독으로 실행 = API 비용 $0
- 개발자에게 익숙한 환경
- CLAUDE.md가 자동 적용되어 규약 준수

**Auto AI 모드:**
- 플랫폼 API 토큰으로 자동 실행
- 비개발자도 사용 가능
- Chat으로 추가 지시 가능

**같은 UI, 같은 Test 버튼, 같은 결과.** 모드만 다름.

---

### 차별화 #3 — 병렬 세션 (tmux 스타일)

- 다른 AI 코딩 도구: 1개 세션만 가능
- DalkkakAI: 5~10개 세션 동시 실행
- 각 세션이 독립 git worktree → 충돌 없음
- SESSION_RULES.md로 자동 조율

---

### 차별화 #4 — 코딩 너머 전체 운영

```
다른 서비스: 아이디어 → 코드 (끝)
DalkkakAI:   아이디어 → 코드 → 테스트 → 배포 → 마케팅 → 결제 → 지원 → 분석
```

Phase 1에서 코딩+테스트+배포까지.
Phase 2~3에서 마케팅+결제+지원+분석 추가.

---

### 차별화 #5 — 스마트 앱 감지

어떤 언어, 어떤 프레임워크로 만들어도 Test 버튼 한 번에 실행.
dalkkak.json > Procfile > Dockerfile > 자동 감지.
하드코딩 0개. AI가 만든 코드의 다양성을 수용.

---

### 종합: DalkkakAI의 가치 공식

```
가치 = (딸깍 전용 CLAUDE.md) × (두 모드) × (병렬 세션) × (전체 운영)
     = 다른 누구도 안 하는 조합
     = "아이디어 → 매출" 원스톱 플랫폼
```

---
