"use client";

import dynamic from "next/dynamic";

const Terminal = dynamic(() => import("../../components/Terminal"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] bg-[#09090b] rounded-xl border border-[#1c1c22]">
      <span className="text-[#52525b] text-sm">Loading terminal...</span>
    </div>
  ),
});

/**
 * Full-page web terminal.
 * Users can run Claude Code CLI with their own Max plan auth.
 * No API token cost — uses user's existing subscription.
 */
export default function TerminalPage() {
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#fafafa]">
            Web Terminal
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-1">
            Run Claude Code with your own account — zero API cost
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-[#0f0f13] rounded-lg border border-[#1c1c22]">
            <span className="text-[#10b981] text-xs font-mono">
              💰 $0.00 — Uses your Max plan
            </span>
          </div>
        </div>
      </div>

      {/* Quick start guide */}
      <div className="grid grid-cols-3 gap-3">
        <div className="px-4 py-3 bg-[#0f0f13] rounded-lg border border-[#1c1c22]">
          <div className="text-[#8b5cf6] text-xs font-semibold mb-1">Step 1</div>
          <div className="text-[#fafafa] text-sm">Type <code className="px-1 py-0.5 bg-[#1c1c22] rounded text-[#06b6d4] text-xs">claude</code></div>
        </div>
        <div className="px-4 py-3 bg-[#0f0f13] rounded-lg border border-[#1c1c22]">
          <div className="text-[#8b5cf6] text-xs font-semibold mb-1">Step 2</div>
          <div className="text-[#fafafa] text-sm">Login with your Anthropic account</div>
        </div>
        <div className="px-4 py-3 bg-[#0f0f13] rounded-lg border border-[#1c1c22]">
          <div className="text-[#8b5cf6] text-xs font-semibold mb-1">Step 3</div>
          <div className="text-[#fafafa] text-sm">Start building — free with Max plan</div>
        </div>
      </div>

      {/* Terminal */}
      <Terminal className="flex-1 min-h-[500px]" />
    </div>
  );
}
