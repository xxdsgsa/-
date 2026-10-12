import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * vitest 配置(PRD 评审:核心纯函数单测覆盖)
 *
 * - happy-dom:DOM 单元(组件测试)
 * - @ 测试别名 指向 src/
 * - include 限定 src/**\/*.test.{ts,tsx}
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/lib/**/*.tsx",
        "!src/lib/**/*.d.ts",
        "!src/lib/auth/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
