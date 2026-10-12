/**
 * 隐私政策(AUTH-005):开发期初版文案,上线前需法务复核
 *
 * V1 需求:3.6.2 底部【隐私政策】链接
 * 数据安全红线:Token/Session 不入 localStorage;草稿为白名单(3.3.5)
 */
import Link from "next/link";

export const metadata = {
  title: "隐私政策 · FitMate",
};

const SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: "1. 我们收集的信息",
    paragraphs: [
      "账号信息:注册时提交的电子邮箱;登录态通过 HttpOnly Cookie 维护。",
      "身体数据:首次设置时由您主动填写的性别、年龄、身高、体重、体脂率、健身目标等。",
      "记录数据:训练(动作/组数/重量/次数)、饮食(食物/份量)、饮水(水量/时间)、补剂(名称/剂量/打卡时间)、体重(数值/日期)。",
      "设备与日志:为排查故障,服务端会记录最小化的访问日志(请求路径、状态码、时间)。",
    ],
  },
  {
    title: "2. 信息的存储",
    paragraphs: [
      "所有正式数据加密存储于第三方云数据库(详见技术文档)。",
      "登录会话使用 HttpOnly + SameSite Cookie,前端 JavaScript 无法读取,降低 XSS 风险。",
      "表单草稿(您正在编辑但未提交的内容)仅保存在您的设备本地,用于在意外关闭应用后恢复编辑;不会同步到我们的服务器,也不会影响您的正式数据。",
    ],
  },
  {
    title: "3. 信息的使用",
    paragraphs: [
      "我们仅在为您提供核心功能(记录、统计、自动计算营养目标、生成训练日历)所必需的范围内使用上述信息。",
      "我们不会将您的信息用于商业广告投放、不会出售给第三方。",
    ],
  },
  {
    title: "4. 您的权利",
    paragraphs: [
      "查阅与导出:您可在【我的】中查看您填写的所有资料与记录;导出功能将在 V1.x 版本上线。",
      "更正:您可随时通过【我的 → 个人资料】与各模块的【编辑】入口修改您的数据。",
      "删除与注销:您可在【我的 → 注销账号】申请注销,我们将进入 15 天冷静期;冷静期内登录可取消,冷静期满后账号与所有数据将永久删除。",
    ],
  },
  {
    title: "5. 第三方服务",
    paragraphs: [
      "邮件发送:为完成验证码(注册、找回密码、注销)功能,我们会通过邮件服务(开发期为控制台输出,上线后接入 Resend)向您填写的邮箱发送验证码。",
      "云数据库:Postgres 兼容数据库(Neon)。",
      "我们仅向必要供应商提供最小化的信息(如向邮件服务商提供您的邮箱地址),并要求其按本政策与适用法律处理数据。",
    ],
  },
  {
    title: "6. 安全",
    paragraphs: [
      "我们采用主流安全实践保护您的数据:密码经哈希后存储(不存明文)、会话使用 HttpOnly Cookie、HTTPS 加密传输。",
      "但请您理解,任何互联网服务都存在理论上的安全风险,无法保证绝对安全;请妥善保管您的密码。",
    ],
  },
  {
    title: "7. 未成年人",
    paragraphs: [
      "本应用面向 13 岁及以上用户。13 岁以下请在监护人指导下使用。",
    ],
  },
  {
    title: "8. 政策变更",
    paragraphs: [
      "我们可能根据产品迭代或法律法规变化,适时修订本政策。",
      "重大变更会通过应用内消息或邮件通知。继续使用即视为接受变更。",
    ],
  },
  {
    title: "9. 联系我们",
    paragraphs: [
      "如对本政策有任何疑问,可通过应用内【我的 → 反馈】与我们联系。",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-prose px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">隐私政策</h1>
      <p className="mb-6 text-xs text-muted-foreground">最近更新:2026-10-12(开发期初版,上线前法务复核)</p>

      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 text-base font-semibold">{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mb-2 text-sm leading-6 text-foreground/90">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10">
        <Link href="/signup" className="text-sm underline underline-offset-2">
          返回注册
        </Link>
      </div>
    </main>
  );
}
