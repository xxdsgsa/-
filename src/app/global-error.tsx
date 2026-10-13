"use client";
/**
 * 根级 Error Boundary:当 root layout 自身 throw 时生效
 * 文档要求:必须包含 <html><body>,不能依赖 i18n/font/layout
 * 样式:行内 style(此时 globals.css 不一定加载)
 */
export default function GlobalError({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, margin: 0 }}>服务暂时不可用</h1>
          <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
            请稍后再试,或刷新页面
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "8px 16px",
              border: "1px solid #ccc",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
