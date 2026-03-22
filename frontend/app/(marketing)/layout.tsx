import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "딸깍AI — 아이디어만 말하면, AI가 만들어드립니다",
  description:
    "아이디어를 설명하면 AI가 빌드, 배포, 운영까지. 코딩 없이 스타트업을 시작하세요.",
  openGraph: {
    title: "딸깍AI — 스타트업 운영체제",
    description:
      "아이디어를 설명하면 AI가 빌드, 배포, 운영까지. 코딩 없이 스타트업을 시작하세요.",
    type: "website",
  },
};

/**
 * Marketing layout — clean layout without dashboard sidebar.
 * Used for landing page and other public-facing marketing pages.
 */
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen bg-[#0f0f23] text-[#e2e8f0]">{children}</div>;
}
