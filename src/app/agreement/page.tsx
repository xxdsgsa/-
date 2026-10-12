/**
 * 用户协议(AUTH-005):开发期初版文案,上线前需法务复核
 *
 * V1 需求:3.6.2 底部【用户协议】链接,未勾选不可注册
 * 数据安全:仅静态展示,无副作用
 */
import Link from "next/link";

export const metadata = {
  title: "用户协议 · FitMate",
};

const SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: "1. 协议接受",
    paragraphs: [
      "欢迎使用 FitMate(以下简称\"本应用\")。本协议是您与本应用运营方之间就使用本应用所订立的协议。",
      "您在注册账户或开始使用本应用时,请仔细阅读本协议全部条款。一旦完成注册或使用,即视为您已充分理解并接受本协议全部内容。",
      "本应用为个人健身辅助工具,功能包括训练计划记录、饮食/饮水/补剂记录、身体数据与统计等。",
    ],
  },
  {
    title: "2. 账号与密码",
    paragraphs: [
      "您应当使用真实有效的电子邮箱完成注册,并妥善保管账号与密码。",
      "因您主动泄露或因您未妥善保管账号、密码而导致的损失,由您本人承担。",
      "如发现账号被盗用或存在其他安全风险,请立即通过【我的 → 反馈】联系我们。",
    ],
  },
  {
    title: "3. 数据归属与使用",
    paragraphs: [
      "您在 FitMate 中输入的健康数据(训练/饮食/饮水/补剂/体重/身体数据),其所有权归您本人。",
      "本应用仅在为您提供产品功能(记录、统计、个性化建议)所必需的范围内使用这些数据,不会用于商业转售。",
      "本应用采用主流云服务托管数据,数据传输使用 HTTPS,登录会话使用 HttpOnly Cookie,核心字段(密码、邮箱)不会被写入浏览器本地存储。",
    ],
  },
  {
    title: "4. 行为规范",
    paragraphs: [
      "您承诺不在本应用中录入、传播违反法律法规的内容,包括但不限于违法宣传、淫秽、暴力、歧视、骚扰等。",
      "本应用为个人工具,不提供社交/分享功能,您对自己的输入内容负全部责任。",
    ],
  },
  {
    title: "5. 免责声明",
    paragraphs: [
      "本应用提供的是数据记录与统计工具,所有训练/营养建议仅供参考,不能替代专业医疗、营养或健身教练的指导。",
      "您在使用本应用期间的身体状况与训练风险由您本人评估并承担。如有既往病史或特殊身体情况,请先咨询专业医师。",
      "未成年人(13 岁以下)请在监护人指导下使用。",
    ],
  },
  {
    title: "6. 协议变更",
    paragraphs: [
      "本应用有权根据法律法规变更或产品迭代,适时修订本协议。",
      "协议变更后,会在本页面更新,并通过应用内消息或邮件通知您。继续使用即视为接受变更。",
    ],
  },
  {
    title: "7. 联系我们",
    paragraphs: [
      "如对本协议有任何疑问,可通过应用内【我的 → 反馈】与我们联系。",
    ],
  },
];

export default function AgreementPage() {
  return (
    <main className="mx-auto w-full max-w-prose px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">用户协议</h1>
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
