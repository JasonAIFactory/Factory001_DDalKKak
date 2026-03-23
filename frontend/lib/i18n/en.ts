/** English translations for DalkkakAI */
import type { TranslationKey } from "./ko";

const en: Record<TranslationKey, string> = {
  // Auth
  "auth.login": "Login",
  "auth.register": "Register",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.name": "Name",
  "auth.signIn": "Sign In",
  "auth.signUp": "Sign Up",
  "auth.signingIn": "Signing in...",
  "auth.creatingAccount": "Creating account...",
  "auth.createAccount": "Create account",
  "auth.noAccount": "Don't have an account?",
  "auth.hasAccount": "Already have an account?",
  "auth.brandSubtitle": "Your startup operating system",
  "auth.accountCreatedSignIn": "Account created — please sign in.",

  // Dashboard
  "dashboard.myStartups": "My Startups",
  "dashboard.createStartup": "Create Startup",
  "dashboard.recentSessions": "Recent Sessions",
  "dashboard.name": "Name",
  "dashboard.description": "Description",
  "dashboard.dashboard": "Dashboard",
  "dashboard.terminal": "Terminal",
  "dashboard.settings": "Settings",
  "dashboard.signOut": "Sign out",

  // Sessions
  "sessions.createSession": "Create Session",
  "sessions.terminal": "Terminal",
  "sessions.autoAI": "Auto AI",
  "sessions.title": "Title",
  "sessions.description": "Description",
  "sessions.running": "Running",
  "sessions.review": "In Review",
  "sessions.completed": "Completed",
  "sessions.error": "Error",

  // Language
  "lang.toggle": "KO",

  // Common
  "common.loading": "Loading...",
  "common.error": "An error occurred",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.approve": "Approve",
  "common.merge": "Merge",
  "common.test": "Test",
  "common.back": "Back",

  // Landing — Header
  "landing.brand": "DalkkakAI",
  "landing.nav.howItWorks": "How It Works",
  "landing.nav.features": "Features",
  "landing.nav.pricing": "Pricing",
  "landing.nav.faq": "FAQ",
  "landing.nav.login": "Login",
  "landing.nav.getStarted": "Get Started",

  // Landing — Hero
  "landing.heroTitle": "Just bring your idea. We handle the rest.",
  "landing.heroBadge": "Startup Operating System",
  "landing.heroHeadline1": "Just describe your idea,",
  "landing.heroHeadline2": "AI builds it for you",
  "landing.heroSubtitle":
    "Build, deploy, and run your startup without any technical knowledge. AI does it all.",
  "landing.heroSubtitleLine1": "Launch your startup without writing code.",
  "landing.heroSubtitleLine2":
    "Describe it and AI handles build, deploy, marketing, and support.",
  "landing.cta": "Get Started Free",
  "landing.howItWorks": "How It Works",
  "landing.features": "Features",
  "landing.pricing": "Pricing",
  "landing.faq": "FAQ",

  // Landing — How It Works
  "landing.howItWorksSubtitle": "One click is all it takes",
  "landing.step1Title": "Describe your idea",
  "landing.step1Desc":
    "Just describe the service you want to build in plain language. No technical knowledge needed.",
  "landing.step2Title": "AI builds it",
  "landing.step2Desc":
    "Code generation, database design, API setup — AI handles it all in parallel.",
  "landing.step3Title": "Auto-deployed",
  "landing.step3Desc":
    "After tests pass, auto-deploy. Get a live URL and share it with customers right away.",

  // Landing — Features
  "landing.featuresTitle": "Core Features",
  "landing.featuresSubtitle":
    "AI handles the complexity, you make the decisions",
  "landing.feat.parallelTitle": "Parallel Sessions",
  "landing.feat.parallelDesc":
    "Develop multiple features simultaneously. Independent sessions per module for faster builds.",
  "landing.feat.deployTitle": "Auto Deploy",
  "landing.feat.deployDesc":
    "When code is ready: test, build, deploy — all automatic. Get your live URL instantly.",
  "landing.feat.terminalTitle": "Web Terminal",
  "landing.feat.terminalDesc":
    "Access the terminal directly in your browser. Work on the server without any local setup.",
  "landing.feat.previewTitle": "Code Preview",
  "landing.feat.previewDesc":
    "Review AI-generated code in real-time. Inspect changes, approve, then merge.",

  // Landing — Pricing
  "landing.pricingTitle": "Pricing",
  "landing.pricingSubtitle":
    "Pick what you need. Upgrade anytime.",
  "landing.pricingPopular": "Popular",
  "landing.pricingFreeDesc": "Get started",
  "landing.pricingStarterDesc": "For serious starters",
  "landing.pricingGrowthDesc": "For growing teams",
  "landing.pricingScaleDesc": "For maximum scale",
  "landing.pricingFreeCta": "Start Free",
  "landing.pricingStarterCta": "Get Started",
  "landing.pricingGrowthCta": "Get Started",
  "landing.pricingScaleCta": "Contact Sales",
  "landing.pricingFeat.startup1": "1 startup",
  "landing.pricingFeat.startup3": "3 startups",
  "landing.pricingFeat.startup10": "10 startups",
  "landing.pricingFeat.session1": "1 concurrent session",
  "landing.pricingFeat.session2": "2 concurrent sessions",
  "landing.pricingFeat.session5": "5 concurrent sessions",
  "landing.pricingFeat.session10": "10 concurrent sessions",
  "landing.pricingFeat.basic": "Basic features",
  "landing.pricingFeat.full": "All features",
  "landing.pricingFeat.community": "Community support",
  "landing.pricingFeat.email": "Email support",
  "landing.pricingFeat.priority": "Priority support",
  "landing.pricingFeat.dedicated": "Dedicated support",
  "landing.pricingFeat.marketing": "Marketing automation",
  "landing.pricingFeat.domain": "Custom domain",
  "landing.pricingFeat.analytics": "Analytics dashboard",
  "landing.pricingFeat.advisor": "AI Advisor",
  "landing.pricingFeat.api": "API access",
  "landing.pricingFeat.sla": "SLA guarantee",
  "landing.pricingFeat.custom": "Custom integrations",

  // Landing — FAQ
  "landing.faqTitle": "Frequently Asked Questions",
  "landing.faq1Q": "Can I use it with zero coding knowledge?",
  "landing.faq1A":
    "Yes, DalkkakAI is designed for non-developers. Describe your idea in plain language and AI handles everything from code generation to deployment.",
  "landing.faq2Q": "What kind of services can I build?",
  "landing.faq2A":
    "SaaS, e-commerce, booking systems, community platforms — most web-based services are possible. AI automatically selects the optimal tech stack.",
  "landing.faq3Q": "Who owns the generated code?",
  "landing.faq3A":
    "All generated code is 100% yours. It's stored in a GitHub repository and you can download or deploy it anywhere, anytime.",
  "landing.faq4Q": "What are the Free plan limitations?",
  "landing.faq4A":
    "The Free plan includes 1 startup and 1 concurrent session. Basic build and deploy features are included — enough to get started.",
  "landing.faq5Q": "Where are deployed services hosted?",
  "landing.faq5A":
    "Auto-deployed via Railway. Custom domain support is included, and paid plans offer dedicated infrastructure.",
  "landing.faq6Q": "Can I import an existing project?",
  "landing.faq6A":
    "Yes, connect your GitHub repository and you can add features or fix bugs in your existing codebase.",

  // Landing — CTA Banner
  "landing.ctaTitle": "Get started today",
  "landing.ctaSubtitle": "If you have an idea, AI handles the rest.",

  // Landing — Footer
  "landing.footerTagline": "Just describe your idea, AI builds it.",
  "landing.footerTagline2": "Startup operating system.",
  "landing.footerProduct": "Product",
  "landing.footerCompany": "Company",
  "landing.footerLegal": "Legal",
  "landing.footerAbout": "About",
  "landing.footerBlog": "Blog",
  "landing.footerCareers": "Careers",
  "landing.footerTerms": "Terms of Service",
  "landing.footerPrivacy": "Privacy Policy",
  "landing.footerContact": "Contact",
  "landing.footerCopyright": "2025 DalkkakAI. All rights reserved.",

  // Pricing
  "pricing.free": "Free",
  "pricing.starter": "Starter",
  "pricing.growth": "Growth",
  "pricing.scale": "Scale",
  "pricing.perMonth": "/ mo",
  "pricing.currentPlan": "Current Plan",
  "pricing.upgrade": "Upgrade",

  // Philosophy
  "philosophy.label": "Our Philosophy",
  "philosophy.quote": "We swallow the complexity. You just click.",
  "philosophy.line1": "Everyone has an idea. But most give up because they can't code. We eliminate that barrier.",
  "philosophy.line2": "Describe your idea and AI builds it. One button to test. One button to launch.",
  "philosophy.line3": "That is 딸깍.",
  "philosophy.step1": "Click",
  "philosophy.step2": "AI Builds",
  "philosophy.step3": "Goes Live",
} as const;

export default en;
