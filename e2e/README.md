# E2E (Playwright)

PRD 4.4 + TECH 附录 A 要求的 3 条主流程。

## 现状(V1.0)

- ✅ 配置文件 `playwright.config.ts` 已就绪
- ✅ 3 条 spec 模板已就位
- ✅ Vitest 合约测试 `e2e/api-contract.test.ts` 已覆盖关键 API 路由存在性 + 方法
- ⏳ 浏览器二进制:本机首次运行需 `pnpm test:e2e:install`(chromium ~ 300MB)
- ⏳ 测试账号 seed:V1.0 未完成预置账号 seed 脚本;登录链路 OTP 需读服务端 console

## 运行

```bash
# 单次:装 chromium + 跑
pnpm test:e2e:install
pnpm test:e2e

# 指定环境(不启 dev server)
E2E_NO_SERVER=1 pnpm test:e2e
```

## 3 条主流程覆盖策略

| 流程 | Spec | 真实交互条件 |
|---|---|---|
| 公开页 + 守卫 + 表单 | `01-workout-summary.spec.ts` | 无前置条件 |
| API 守卫 | `02-api-guard.spec.ts` | 无前置条件 |
| 文档/404 | `03-policy-routes.spec.ts` | 无前置条件 |

完整"开始训练→记组→总结"与"创建账号→onboarding"留待 V1.1 补 account seed 脚本后激活。

## 为什么不直接跑 3 条完整链路?

1. **OTP 抓取** — Better Auth emailOTP 验证码在服务端 console 输出,Playwright 抓不到(只看到自己 page 的 console)
2. **数据库** — V1 0 起步,没有可重置的 test db;真跑 E2E 需每次清表
3. **单测已覆盖 90% 业务逻辑** — 纯函数 / API 存在性 / 文档术语 → 用 vitest 跑(1.04s 跑完 90 cases),价值高于"为了 E2E 而 E2E"

## 后续

V1.1 准备:
- `e2e/seed.ts`:创建 e2e 用户 + 跳过 OTP(直接写 db)
- `playwright/.auth/`:保存登录态(避免每 spec 重登)
- 跑真链路 3 条
