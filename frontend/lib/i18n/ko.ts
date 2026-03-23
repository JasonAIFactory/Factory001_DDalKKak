/** Korean translations — default language for DalkkakAI */
const ko = {
  // Auth
  "auth.login": "로그인",
  "auth.register": "회원가입",
  "auth.email": "이메일",
  "auth.password": "비밀번호",
  "auth.signIn": "로그인하기",
  "auth.signUp": "회원가입하기",
  "auth.noAccount": "계정이 없으신가요?",
  "auth.hasAccount": "이미 계정이 있으신가요?",

  // Dashboard
  "dashboard.myStartups": "내 스타트업",
  "dashboard.createStartup": "스타트업 만들기",
  "dashboard.recentSessions": "최근 세션",
  "dashboard.name": "이름",
  "dashboard.description": "설명",

  // Sessions
  "sessions.createSession": "세션 생성",
  "sessions.terminal": "터미널",
  "sessions.autoAI": "자동 AI",
  "sessions.title": "제목",
  "sessions.description": "설명",
  "sessions.running": "실행 중",
  "sessions.review": "검토 중",
  "sessions.completed": "완료",
  "sessions.error": "오류",

  // Common
  "common.loading": "로딩 중...",
  "common.error": "오류가 발생했습니다",
  "common.save": "저장",
  "common.cancel": "취소",
  "common.delete": "삭제",
  "common.approve": "승인",
  "common.merge": "병합",
  "common.test": "테스트",
  "common.back": "뒤로",

  // Landing
  "landing.heroTitle": "아이디어만 있으면 됩니다. 나머지는 딸깍.",
  "landing.heroSubtitle":
    "기술 지식 없이도 스타트업을 만들고, 배포하고, 운영하세요. AI가 전부 해드립니다.",
  "landing.cta": "무료로 시작하기",
  "landing.howItWorks": "어떻게 작동하나요?",
  "landing.features": "주요 기능",
  "landing.pricing": "요금제",
  "landing.faq": "자주 묻는 질문",

  // Pricing
  "pricing.free": "무료",
  "pricing.starter": "스타터",
  "pricing.growth": "그로스",
  "pricing.scale": "스케일",
  "pricing.perMonth": "/ 월",
  "pricing.currentPlan": "현재 플랜",
  "pricing.upgrade": "업그레이드",
} as const;

export type TranslationKey = keyof typeof ko;
export default ko;
