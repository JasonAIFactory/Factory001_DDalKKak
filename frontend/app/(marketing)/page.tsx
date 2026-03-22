import Link from "next/link";
import {
  Zap,
  Layers,
  Rocket,
  Terminal,
  Code2,
  ChevronRight,
  Check,
  ArrowRight,
  MousePointerClick,
  Cpu,
  Globe,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Hero Section
   ───────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 pt-32 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm">
          <Zap className="w-4 h-4" />
          <span>스타트업 운영체제</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight">
          아이디어만 말하면,
          <br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI가 만들어드립니다
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          코딩 없이 스타트업을 시작하세요.
          <br className="hidden sm:block" />
          설명하면 AI가 빌드, 배포, 마케팅, 고객지원까지 전부 처리합니다.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-colors"
          >
            무료로 시작하기
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium text-lg transition-colors"
          >
            어떻게 작동하나요?
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   How It Works — 3 Steps
   ───────────────────────────────────────────── */
const STEPS = [
  {
    step: "01",
    icon: MousePointerClick,
    title: "아이디어를 설명하세요",
    description:
      "만들고 싶은 서비스를 자연어로 설명하면 됩니다. 기술 지식은 필요 없어요.",
  },
  {
    step: "02",
    icon: Cpu,
    title: "AI가 빌드합니다",
    description:
      "코드 생성, 데이터베이스 설계, API 구축까지 AI가 병렬로 처리합니다.",
  },
  {
    step: "03",
    icon: Globe,
    title: "자동으로 배포됩니다",
    description:
      "테스트 통과 후 자동 배포. 라이브 URL을 받아 바로 고객에게 공유하세요.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-[#0a0a1a]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">어떻게 작동하나요?</h2>
          <p className="mt-4 text-gray-400 text-lg">
            딸깍 한 번이면 충분합니다
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map(({ step, icon: Icon, title, description }) => (
            <div
              key={step}
              className="relative p-8 rounded-2xl border border-gray-800 bg-[#12122a] hover:border-indigo-500/40 transition-colors"
            >
              <span className="text-5xl font-extrabold text-indigo-500/20 absolute top-4 right-6">
                {step}
              </span>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{title}</h3>
              <p className="text-gray-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Features Grid
   ───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Layers,
    title: "병렬 세션",
    description:
      "여러 기능을 동시에 개발합니다. 모듈별로 독립 세션이 병렬 실행되어 빌드 속도가 빨라집니다.",
  },
  {
    icon: Rocket,
    title: "자동 배포",
    description:
      "코드가 완성되면 테스트 → 빌드 → 배포까지 자동. 라이브 URL을 즉시 받아보세요.",
  },
  {
    icon: Terminal,
    title: "웹 터미널",
    description:
      "브라우저에서 직접 터미널에 접속하세요. 로컬 설치 없이 서버에서 바로 작업할 수 있습니다.",
  },
  {
    icon: Code2,
    title: "코드 프리뷰",
    description:
      "AI가 생성한 코드를 실시간으로 확인하세요. 변경 사항을 검토하고 승인한 후 머지합니다.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">핵심 기능</h2>
          <p className="mt-4 text-gray-400 text-lg">
            복잡한 건 AI가 처리하고, 당신은 결정만 하세요
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-8 rounded-2xl border border-gray-800 bg-[#12122a] hover:border-indigo-500/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{title}</h3>
              <p className="text-gray-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Pricing Table
   ───────────────────────────────────────────── */
interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "시작해보세요",
    features: [
      "스타트업 1개",
      "동시 세션 1개",
      "기본 기능",
      "커뮤니티 지원",
    ],
    cta: "무료로 시작",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$29",
    period: "/월",
    description: "본격적으로 시작할 때",
    features: [
      "스타트업 1개",
      "동시 세션 2개",
      "마케팅 자동화",
      "이메일 지원",
      "커스텀 도메인",
    ],
    cta: "시작하기",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$99",
    period: "/월",
    description: "성장하는 팀에게",
    features: [
      "스타트업 3개",
      "동시 세션 5개",
      "전체 기능",
      "우선 지원",
      "분석 대시보드",
      "AI 어드바이저",
    ],
    cta: "시작하기",
    highlighted: true,
  },
  {
    name: "Scale",
    price: "$299",
    period: "/월",
    description: "최대 규모를 위해",
    features: [
      "스타트업 10개",
      "동시 세션 10개",
      "전체 기능",
      "전담 지원",
      "API 접근",
      "SLA 보장",
      "커스텀 인테그레이션",
    ],
    cta: "영업팀 문의",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-[#0a0a1a]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">요금제</h2>
          <p className="mt-4 text-gray-400 text-lg">
            필요한 만큼만 선택하세요. 언제든 업그레이드할 수 있습니다.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-8 rounded-2xl border transition-colors ${
                plan.highlighted
                  ? "border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/10"
                  : "border-gray-800 bg-[#12122a] hover:border-gray-700"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-semibold rounded-full bg-indigo-600 text-white">
                  인기
                </span>
              )}

              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

              <div className="mt-6 mb-8">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-gray-500 ml-1">{plan.period}</span>
                )}
              </div>

              <ul className="flex-1 space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 mt-0.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`block w-full text-center py-3 rounded-xl font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FAQ Section
   ───────────────────────────────────────────── */
const FAQS = [
  {
    q: "코딩을 전혀 몰라도 사용할 수 있나요?",
    a: "네, 딸깍AI는 비개발자를 위해 설계되었습니다. 아이디어를 자연어로 설명하면 AI가 코드 생성부터 배포까지 전부 처리합니다.",
  },
  {
    q: "어떤 종류의 서비스를 만들 수 있나요?",
    a: "SaaS, 이커머스, 예약 시스템, 커뮤니티 플랫폼 등 웹 기반 서비스라면 대부분 가능합니다. AI가 최적의 기술 스택을 자동으로 선택합니다.",
  },
  {
    q: "생성된 코드의 소유권은 누구에게 있나요?",
    a: "생성된 모든 코드는 100% 사용자 소유입니다. GitHub 리포지토리에 저장되며 언제든 다운로드하거나 다른 곳에 배포할 수 있습니다.",
  },
  {
    q: "무료 플랜의 제한은 무엇인가요?",
    a: "무료 플랜에서는 스타트업 1개, 동시 세션 1개를 사용할 수 있습니다. 기본적인 빌드와 배포 기능이 포함되어 있어 충분히 시작할 수 있습니다.",
  },
  {
    q: "배포된 서비스는 어디에서 호스팅되나요?",
    a: "Railway를 통해 자동 배포됩니다. 커스텀 도메인 연결도 지원하며, 유료 플랜에서는 전용 인프라를 제공합니다.",
  },
  {
    q: "기존 프로젝트를 가져올 수 있나요?",
    a: "네, GitHub 리포지토리를 연결하면 기존 코드베이스에 기능을 추가하거나 버그를 수정할 수 있습니다.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">자주 묻는 질문</h2>
        </div>

        <div className="space-y-4">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl border border-gray-800 bg-[#12122a] overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer px-8 py-5 text-left font-medium hover:text-white transition-colors">
                {q}
                <ChevronRight className="w-5 h-5 text-gray-500 group-open:rotate-90 transition-transform flex-shrink-0 ml-4" />
              </summary>
              <div className="px-8 pb-6 text-gray-400 leading-relaxed">
                {a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA Banner
   ───────────────────────────────────────────── */
function CTABanner() {
  return (
    <section className="py-24 bg-[#0a0a1a]">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          지금 시작하세요
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          아이디어가 있다면, 나머지는 AI가 합니다.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-colors"
        >
          무료로 시작하기
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Header (Navigation)
   ───────────────────────────────────────────── */
function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f23]/80 backdrop-blur-lg border-b border-gray-800/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white text-lg">딸깍AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#how-it-works" className="hover:text-white transition-colors">
            작동 방식
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            기능
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            요금제
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            시작하기
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────
   Footer
   ───────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-[#0f0f23]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-white">딸깍AI</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              아이디어만 말하면, AI가 만들어드립니다.
              <br />
              스타트업 운영체제.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">제품</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#features" className="hover:text-gray-300 transition-colors">
                  기능
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-gray-300 transition-colors">
                  요금제
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-gray-300 transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">회사</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  소개
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  블로그
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  채용
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">법적 고지</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  이용약관
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  개인정보처리방침
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  문의하기
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-600">
          &copy; 2025 딸깍AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   Landing Page — Main Export
   ───────────────────────────────────────────── */

/**
 * Public landing page for DalkkakAI.
 * Showcases the product value proposition, features, pricing, and FAQ.
 * Korean user-facing text with English code.
 */
export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
