"use client";

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
  Languages,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

/* ─────────────────────────────────────────────
   Hero Section
   ───────────────────────────────────────────── */
function Hero() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 pt-32 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm">
          <Zap className="w-4 h-4" />
          <span>{t("landing.heroBadge")}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight">
          {t("landing.heroHeadline1")}
          <br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {t("landing.heroHeadline2")}
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          {t("landing.heroSubtitleLine1")}
          <br className="hidden sm:block" />
          {t("landing.heroSubtitleLine2")}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-colors"
          >
            {t("landing.cta")}
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium text-lg transition-colors"
          >
            {t("landing.howItWorks")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   How It Works — 3 Steps
   ───────────────────────────────────────────── */
function HowItWorks() {
  const { t } = useT();

  const steps = [
    {
      step: "01",
      icon: MousePointerClick,
      titleKey: "landing.step1Title" as TranslationKey,
      descKey: "landing.step1Desc" as TranslationKey,
    },
    {
      step: "02",
      icon: Cpu,
      titleKey: "landing.step2Title" as TranslationKey,
      descKey: "landing.step2Desc" as TranslationKey,
    },
    {
      step: "03",
      icon: Globe,
      titleKey: "landing.step3Title" as TranslationKey,
      descKey: "landing.step3Desc" as TranslationKey,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#0a0a1a]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            {t("landing.howItWorks")}
          </h2>
          <p className="mt-4 text-gray-400 text-lg">
            {t("landing.howItWorksSubtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map(({ step, icon: Icon, titleKey, descKey }) => (
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
              <h3 className="text-xl font-semibold mb-3">{t(titleKey)}</h3>
              <p className="text-gray-400 leading-relaxed">{t(descKey)}</p>
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
function Features() {
  const { t } = useT();

  const features = [
    {
      icon: Layers,
      titleKey: "landing.feat.parallelTitle" as TranslationKey,
      descKey: "landing.feat.parallelDesc" as TranslationKey,
    },
    {
      icon: Rocket,
      titleKey: "landing.feat.deployTitle" as TranslationKey,
      descKey: "landing.feat.deployDesc" as TranslationKey,
    },
    {
      icon: Terminal,
      titleKey: "landing.feat.terminalTitle" as TranslationKey,
      descKey: "landing.feat.terminalDesc" as TranslationKey,
    },
    {
      icon: Code2,
      titleKey: "landing.feat.previewTitle" as TranslationKey,
      descKey: "landing.feat.previewDesc" as TranslationKey,
    },
  ];

  return (
    <section id="features" className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            {t("landing.featuresTitle")}
          </h2>
          <p className="mt-4 text-gray-400 text-lg">
            {t("landing.featuresSubtitle")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map(({ icon: Icon, titleKey, descKey }) => (
            <div
              key={titleKey}
              className="p-8 rounded-2xl border border-gray-800 bg-[#12122a] hover:border-indigo-500/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t(titleKey)}</h3>
              <p className="text-gray-400 leading-relaxed">{t(descKey)}</p>
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
interface PlanDef {
  name: string;
  price: string;
  period: string;
  descKey: TranslationKey;
  featureKeys: TranslationKey[];
  ctaKey: TranslationKey;
  highlighted: boolean;
}

const PLANS: PlanDef[] = [
  {
    name: "Free",
    price: "$0",
    period: "",
    descKey: "landing.pricingFreeDesc",
    featureKeys: [
      "landing.pricingFeat.startup1",
      "landing.pricingFeat.session1",
      "landing.pricingFeat.basic",
      "landing.pricingFeat.community",
    ],
    ctaKey: "landing.pricingFreeCta",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    descKey: "landing.pricingStarterDesc",
    featureKeys: [
      "landing.pricingFeat.startup1",
      "landing.pricingFeat.session2",
      "landing.pricingFeat.marketing",
      "landing.pricingFeat.email",
      "landing.pricingFeat.domain",
    ],
    ctaKey: "landing.pricingStarterCta",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$99",
    period: "/mo",
    descKey: "landing.pricingGrowthDesc",
    featureKeys: [
      "landing.pricingFeat.startup3",
      "landing.pricingFeat.session5",
      "landing.pricingFeat.full",
      "landing.pricingFeat.priority",
      "landing.pricingFeat.analytics",
      "landing.pricingFeat.advisor",
    ],
    ctaKey: "landing.pricingGrowthCta",
    highlighted: true,
  },
  {
    name: "Scale",
    price: "$299",
    period: "/mo",
    descKey: "landing.pricingScaleDesc",
    featureKeys: [
      "landing.pricingFeat.startup10",
      "landing.pricingFeat.session10",
      "landing.pricingFeat.full",
      "landing.pricingFeat.dedicated",
      "landing.pricingFeat.api",
      "landing.pricingFeat.sla",
      "landing.pricingFeat.custom",
    ],
    ctaKey: "landing.pricingScaleCta",
    highlighted: false,
  },
];

function Pricing() {
  const { t } = useT();
  return (
    <section id="pricing" className="py-24 bg-[#0a0a1a]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            {t("landing.pricingTitle")}
          </h2>
          <p className="mt-4 text-gray-400 text-lg">
            {t("landing.pricingSubtitle")}
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
                  {t("landing.pricingPopular")}
                </span>
              )}

              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {t(plan.descKey)}
              </p>

              <div className="mt-6 mb-8">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-gray-500 ml-1">{plan.period}</span>
                )}
              </div>

              <ul className="flex-1 space-y-3 mb-8">
                {plan.featureKeys.map((fk) => (
                  <li key={fk} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 mt-0.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-gray-300">{t(fk)}</span>
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
                {t(plan.ctaKey)}
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
function FAQ() {
  const { t } = useT();

  const faqs: { qKey: TranslationKey; aKey: TranslationKey }[] = [
    { qKey: "landing.faq1Q", aKey: "landing.faq1A" },
    { qKey: "landing.faq2Q", aKey: "landing.faq2A" },
    { qKey: "landing.faq3Q", aKey: "landing.faq3A" },
    { qKey: "landing.faq4Q", aKey: "landing.faq4A" },
    { qKey: "landing.faq5Q", aKey: "landing.faq5A" },
    { qKey: "landing.faq6Q", aKey: "landing.faq6A" },
  ];

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            {t("landing.faqTitle")}
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map(({ qKey, aKey }) => (
            <details
              key={qKey}
              className="group rounded-2xl border border-gray-800 bg-[#12122a] overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer px-8 py-5 text-left font-medium hover:text-white transition-colors">
                {t(qKey)}
                <ChevronRight className="w-5 h-5 text-gray-500 group-open:rotate-90 transition-transform flex-shrink-0 ml-4" />
              </summary>
              <div className="px-8 pb-6 text-gray-400 leading-relaxed">
                {t(aKey)}
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
  const { t } = useT();
  return (
    <section className="py-24 bg-[#0a0a1a]">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          {t("landing.ctaTitle")}
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          {t("landing.ctaSubtitle")}
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-colors"
        >
          {t("landing.cta")}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Header (Navigation) + Language Toggle
   ───────────────────────────────────────────── */
function Header() {
  const { t, lang, setLang } = useT();

  /** Toggle between ko and en */
  function toggleLang() {
    setLang(lang === "ko" ? "en" : "ko");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f23]/80 backdrop-blur-lg border-b border-gray-800/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white text-lg">
            {t("landing.brand")}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a
            href="#how-it-works"
            className="hover:text-white transition-colors"
          >
            {t("landing.nav.howItWorks")}
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            {t("landing.nav.features")}
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            {t("landing.nav.pricing")}
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            {t("landing.nav.faq")}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-sm transition-colors"
            aria-label="Toggle language"
          >
            <Languages className="w-4 h-4" />
            {t("lang.toggle")}
          </button>

          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
          >
            {t("landing.nav.login")}
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            {t("landing.nav.getStarted")}
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
  const { t } = useT();
  return (
    <footer className="border-t border-gray-800 bg-[#0f0f23]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-white">{t("landing.brand")}</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("landing.footerTagline")}
              <br />
              {t("landing.footerTagline2")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t("landing.footerProduct")}
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a
                  href="#features"
                  className="hover:text-gray-300 transition-colors"
                >
                  {t("landing.nav.features")}
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-gray-300 transition-colors"
                >
                  {t("landing.nav.pricing")}
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="hover:text-gray-300 transition-colors"
                >
                  {t("landing.nav.faq")}
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t("landing.footerCompany")}
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  {t("landing.footerAbout")}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  {t("landing.footerBlog")}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  {t("landing.footerCareers")}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">
              {t("landing.footerLegal")}
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  {t("landing.footerTerms")}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  {t("landing.footerPrivacy")}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gray-300 transition-colors">
                  {t("landing.footerContact")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-600">
          &copy; {t("landing.footerCopyright")}
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
 * All user-facing strings loaded via i18n t() for KO/EN support.
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
