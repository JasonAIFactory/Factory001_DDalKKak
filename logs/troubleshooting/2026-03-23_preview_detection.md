# Troubleshooting — Preview App Detection Failures
## 2026-03-23

---

### 문제
Test 버튼 누르면 프리뷰 컨테이너가 크래시. 매번 다른 이유.

### 발생 이력
| 시도 | 에러 | 원인 |
|------|------|------|
| 1 | `python: can't open file 'main.py'` | Claude가 `app.py`로 만들었는데 `main.py`만 찾음 |
| 2 | `No such file or directory` | 순수 HTML인데 Python으로 실행 시도 |
| 3 | 포트 접속 불가 | 컨테이너 내부 5000포트인데 8000으로 매핑 |
| 4 | health check 실패 | API 컨테이너 localhost ≠ 호스트 localhost |

### 근본 원인
파일명 하드코딩 방식으로 앱 타입 감지 → 어떤 구조로든 만들 수 있는 AI 코드 생성 환경에서 실패 필연적.

### 해결 — 3단계 진화

**1단계: 하드코딩 (실패)**
```python
if (path / "main.py").exists(): return "fastapi"
# → app.py, server.py, run.py 전부 누락
```

**2단계: 파일명 목록 확장 (임시 해결)**
```python
has_main_py = path/"main.py" or path/"app.py" or path/"server.py"
# → 새 패턴 나올 때마다 추가해야 함 = 유지보수 지옥
```

**3단계: 스마트 감지 (최종 해결)**
```
우선순위 기반:
1. dalkkak.json → 명시적 설정 (100% 확실)
2. Procfile → 업계 표준
3. Dockerfile → 빌드 후 실행
4. package.json → scripts.start 읽기
5. *.py 파일 내용 스캔 → Flask/FastAPI import 찾기
6. index.html → 정적 서빙
7. unknown → 에러 + 가이드 표시
```

### 핵심 교훈
- AI가 만든 코드는 **어떤 구조든** 가능 → 하드코딩 감지는 반드시 실패
- `dalkkak.json`이 최우선 → 없어도 90% 자동 감지
- Python 앱은 **파일 내용을 스캔**해서 프레임워크 감지 (파일명 무의미)
- 포트도 하드코딩 금지 → 코드에서 `port`/`PORT`/`listen(` 찾아서 감지

---
