/** English translations for DalkkakAI */
import type { TranslationKey } from "./ko";

const en: Record<TranslationKey, string> = {
  // Auth
  "auth.login": "Login",
  "auth.register": "Register",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign In",
  "auth.signUp": "Sign Up",
  "auth.noAccount": "Don't have an account?",
  "auth.hasAccount": "Already have an account?",

  // Dashboard
  "dashboard.myStartups": "My Startups",
  "dashboard.createStartup": "Create Startup",
  "dashboard.recentSessions": "Recent Sessions",
  "dashboard.name": "Name",
  "dashboard.description": "Description",

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

  // Landing
  "landing.heroTitle": "Just bring your idea. We handle the rest.",
  "landing.heroSubtitle":
    "Build, deploy, and run your startup without any technical knowledge. AI does it all.",
  "landing.cta": "Get Started Free",
  "landing.howItWorks": "How It Works",
  "landing.features": "Features",
  "landing.pricing": "Pricing",
  "landing.faq": "FAQ",

  // Pricing
  "pricing.free": "Free",
  "pricing.starter": "Starter",
  "pricing.growth": "Growth",
  "pricing.scale": "Scale",
  "pricing.perMonth": "/ mo",
  "pricing.currentPlan": "Current Plan",
  "pricing.upgrade": "Upgrade",
} as const;

export default en;
