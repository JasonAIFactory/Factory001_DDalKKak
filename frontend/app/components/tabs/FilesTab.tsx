"use client";

/**
 * Files tab content for session detail view.
 * Left panel: searchable file tree grouped by directory.
 * Right panel: code viewer with line numbers.
 */

import { useEffect, useState } from "react";
import { Loader2, FileCode } from "lucide-react";
import { getToken, type Session } from "@/lib/api";
import { C, API_BASE } from "@/app/components/shared/constants";

function getFileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const iconMap: Record<string, string> = {
    py: "🐍", ts: "📘", tsx: "📘", js: "📒", jsx: "📒",
    json: "📋", md: "📝", yml: "⚙️", yaml: "⚙️", toml: "⚙️",
    css: "🎨", html: "🌐", sql: "🗃️", sh: "💻", bash: "💻",
    dockerfile: "🐳", gitignore: "👁️",
  };
  return iconMap[ext] || "📄";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface FileEntry { path: string; size: number; }

export default function FilesTab({ session, startupId }: { session: Session; startupId: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  /** Fetch file tree from backend. */
  useEffect(() => {
    setTreeLoading(true);
    fetch(
      `${API_BASE}/api/sessions/${session.id}/file-tree?startup_id=${startupId}`,
      { headers: { Authorization: `Bearer ${getToken()}` } },
    )
      .then(r => r.json())
      .then(json => { if (json.ok) setFiles(json.data ?? []); })
      .catch(() => {})
      .finally(() => setTreeLoading(false));
  }, [session.id, startupId]);

  /** Fetch a single file's content for display. */
  async function loadFile(path: string) {
    setSelectedFile(path);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/sessions/${session.id}/files/${encodeURIComponent(path)}?startup_id=${startupId}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      const json = await res.json();
      if (json.ok) {
        setFileContent(json.data.content);
      } else {
        setError(json.error || "Failed to load file");
        setFileContent("");
      }
    } catch {
      setError("Network error");
      setFileContent("");
    } finally {
      setLoading(false);
    }
  }

  const filtered = search
    ? files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()))
    : files;

  const grouped: Record<string, FileEntry[]> = {};
  for (const f of filtered) {
    const parts = f.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  }
  const sortedDirs = Object.keys(grouped).sort();

  if (treeLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.accentPurple }} />
        <span className="text-sm" style={{ color: C.textMuted }}>Loading files...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <FileCode className="w-8 h-8" style={{ color: C.textMuted }} />
        <p className="text-sm" style={{ color: C.textMuted }}>No files in this workspace yet.</p>
        <p className="text-xs" style={{ color: C.textMuted }}>Run Claude Code in Terminal to generate code.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: file tree */}
      <div className="w-72 flex-shrink-0 overflow-auto flex flex-col" style={{ borderRight: `1px solid ${C.bgTertiary}` }}>
        <div className="p-3" style={{ borderBottom: `1px solid ${C.bgTertiary}` }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full rounded-md px-3 py-1.5 text-xs outline-none"
            style={{ backgroundColor: C.bgPrimary, color: C.textPrimary, border: `1px solid ${C.bgTertiary}` }}
          />
        </div>
        <div className="px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>
            {filtered.length} files
          </p>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-3">
          {sortedDirs.map(dir => (
            <div key={dir} className="mb-2">
              {dir !== "." && (
                <p className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 truncate" style={{ color: C.textMuted }}>
                  {dir}/
                </p>
              )}
              {grouped[dir].map(f => {
                const fileName = f.path.split("/").pop() ?? f.path;
                return (
                  <button
                    key={f.path}
                    onClick={() => loadFile(f.path)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-mono transition-all mb-0.5"
                    style={{
                      backgroundColor: selectedFile === f.path ? `${C.accentPurple}15` : "transparent",
                      color: selectedFile === f.path ? C.accentPurple : C.textSecondary,
                    }}
                  >
                    <span className="text-[10px] flex-shrink-0">{getFileIcon(f.path)}</span>
                    <span className="truncate flex-1">{fileName}</span>
                    <span className="text-[9px] flex-shrink-0" style={{ color: C.textMuted }}>{formatFileSize(f.size)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right: code viewer */}
      <div className="flex-1 overflow-auto">
        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <FileCode className="w-6 h-6" style={{ color: C.textMuted }} />
            <p className="text-sm" style={{ color: C.textMuted }}>Select a file to view</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.accentPurple }} />
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="rounded-lg p-4" style={{ backgroundColor: `${C.red}11`, border: `1px solid ${C.red}33` }}>
              <p className="text-sm" style={{ color: C.red }}>{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="sticky top-0 px-4 py-2 flex items-center gap-2 z-10" style={{ backgroundColor: C.bgSecondary, borderBottom: `1px solid ${C.bgTertiary}` }}>
              <span className="text-sm">{getFileIcon(selectedFile)}</span>
              <span className="text-xs font-mono" style={{ color: C.textSecondary }}>{selectedFile}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto" style={{ backgroundColor: `${C.green}22`, color: C.green }}>
                {fileContent.split("\n").length} lines
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${C.accentCyan}22`, color: C.accentCyan }}>
                {formatFileSize(new Blob([fileContent]).size)}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <pre className="p-0 text-[13px] leading-6" style={{ color: C.textSecondary, fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
                <table className="w-full border-collapse">
                  <tbody>
                    {fileContent.split("\n").map((line, i) => (
                      <tr key={i} className="hover:brightness-125 transition-all group">
                        <td
                          className="text-right pr-4 pl-4 select-none w-12 align-top"
                          style={{ color: C.textMuted, borderRight: `1px solid ${C.bgTertiary}` }}
                        >
                          {i + 1}
                        </td>
                        <td className="pl-4 whitespace-pre overflow-x-auto">{line || " "}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
