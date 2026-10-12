/**
 * 我的页(Tab 5,PRD 3.6.7):
 * - 顶部:头像(首字母)+ 昵称 + 邮箱
 * - 个人资料(只读卡片):身高/体重/年龄/性别/体脂率
 * - 我的目标:五项营养目标(已手动标"已调整")
 * - 设置入口:饮水目标调整 / 协议 / 隐私 / 退出 / 注销
 *
 * V1.0 暂不做资料编辑(下一次迭代);当前 RSC 拉取完整 profile 视图。
 */
import { ChevronRight, Droplet } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeletionButton } from "@/components/deletion-button";
import { SignOutButton } from "@/components/sign-out-button";
import { WaterGoalForm } from "@/components/water-goal-form";
import { auth } from "@/lib/auth";
import { getUserProfile } from "@/lib/db/queries/account";

import { ProfileWaterButton } from "./profile-water-button";

const GENDER_LABEL: Record<string, string> = { male: "男", female: "女" };
const GOAL_LABEL: Record<string, string> = {
  fat_loss: "减脂",
  muscle_gain: "增肌",
  recomp: "重塑",
  health: "保持",
};

function fmtKg(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)} kg`;
}

function fmtCm(n: number | null): string {
  return n == null ? "—" : `${n} cm`;
}

function fmtPct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)} %`;
}

export default async function ProfilePage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) redirect("/login");

  const profile = await getUserProfile(session.user.id);
  // 极少场景(session 存在但 profile 拉不到);兜底
  if (!profile) redirect("/login");

  const initial = (profile.nickname || profile.name || "F").charAt(0).toUpperCase();
  const nu = profile.nutrition;
  const nuRows = [
    { label: "热量", value: nu.calories, unit: "kcal", manual: nu.manual.calories },
    { label: "蛋白质", value: nu.protein, unit: "g", manual: nu.manual.protein },
    { label: "碳水", value: nu.carbs, unit: "g", manual: nu.manual.carbs },
    { label: "脂肪", value: nu.fat, unit: "g", manual: nu.manual.fat },
    { label: "饮水", value: nu.water, unit: "ml", manual: nu.manual.water },
  ];

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-6">
      <h1 className="text-xl font-bold">我的</h1>

      {/* 顶部:头像 + 昵称 + 邮箱 */}
      <div className="mt-4 flex items-center gap-3 rounded-lg border bg-card p-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">
            {profile.nickname || profile.name || "FitMate 用户"}
          </p>
          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      {/* 个人资料(只读) */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">个人资料</h2>
        <div className="rounded-lg border bg-card">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <Row label="性别" value={profile.gender ? GENDER_LABEL[profile.gender] ?? "—" : "—"} />
            <Row label="年龄" value={profile.age != null ? `${profile.age} 岁` : "—"} />
            <Row label="身高" value={fmtCm(profile.heightCm)} />
            <Row
              label="目标体重"
              value={fmtKg(profile.targetWeightKg)}
            />
            <Row label="体脂率" value={fmtPct(profile.bodyFatPct)} />
            <Row
              label="每周训练"
              value={
                profile.weeklyTrainingDays != null ? `${profile.weeklyTrainingDays} 次` : "—"
              }
            />
          </div>
          {profile.goalType && (
            <div className="border-t px-4 py-2.5 text-sm text-muted-foreground">
              目标:{GOAL_LABEL[profile.goalType] ?? profile.goalType}
              {profile.targetWeightKg ? ` · 目标体重 ${profile.targetWeightKg}kg` : ""}
            </div>
          )}
          <div className="border-t px-4 py-2.5">
            <p className="text-xs text-muted-foreground">编辑资料 V1.x 接入</p>
          </div>
        </div>
      </section>

      {/* 营养目标 */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">我的目标</h2>
        <div className="rounded-lg border bg-card divide-y">
          {nuRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{r.label}</span>
              <span className="tabular-nums">
                {r.value != null ? `${r.value} ${r.unit}` : "未设置"}
                {r.manual && <span className="ml-2 text-xs text-orange-500">已手动调整</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 设置 */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">设置</h2>
        <div className="rounded-lg border bg-card divide-y">
          <ProfileWaterButton
            currentMl={nu.water}
            manual={nu.manual.water}
          />
          <LinkRow href="/agreement" label="用户协议" />
          <LinkRow href="/privacy" label="隐私政策" />
          <div className="px-4 py-2.5 text-sm">
            关于 <span className="ml-1 text-muted-foreground">V1.0</span>
          </div>
          <div className="px-4 py-3">
            <SignOutButton />
          </div>
          <div className="px-4 py-2.5 text-center">
            <DeletionButton />
          </div>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span>{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
