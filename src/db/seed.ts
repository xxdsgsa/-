/**
 * 官方种子数据:动作库 80 条 + 食物库 48 条
 *
 * 幂等:已存在官方数据(owner_id IS NULL)则跳过。
 * 运行:先在 .env 配好 DATABASE_URL,再 pnpm db:migrate && pnpm db:seed
 */
import { neon } from "@neondatabase/serverless";
import { count, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { exercises, foods } from "./schema";

type ExerciseSeed = { name: string; category: string; muscleGroup: string };

const STRENGTH = "力量";
const CARDIO = "有氧";
const BODYWEIGHT = "自重";

const EXERCISES: ExerciseSeed[] = [
  // 胸(12)
  { name: "杠铃平板卧推", category: STRENGTH, muscleGroup: "胸" },
  { name: "上斜杠铃卧推", category: STRENGTH, muscleGroup: "胸" },
  { name: "下斜杠铃卧推", category: STRENGTH, muscleGroup: "胸" },
  { name: "哑铃平板卧推", category: STRENGTH, muscleGroup: "胸" },
  { name: "上斜哑铃卧推", category: STRENGTH, muscleGroup: "胸" },
  { name: "哑铃飞鸟", category: STRENGTH, muscleGroup: "胸" },
  { name: "上斜哑铃飞鸟", category: STRENGTH, muscleGroup: "胸" },
  { name: "蝴蝶机夹胸", category: STRENGTH, muscleGroup: "胸" },
  { name: "绳索夹胸", category: STRENGTH, muscleGroup: "胸" },
  { name: "双杠臂屈伸", category: BODYWEIGHT, muscleGroup: "胸" },
  { name: "标准俯卧撑", category: BODYWEIGHT, muscleGroup: "胸" },
  { name: "史密斯卧推", category: STRENGTH, muscleGroup: "胸" },
  // 背(14)
  { name: "正手引体向上", category: BODYWEIGHT, muscleGroup: "背" },
  { name: "高位下拉", category: STRENGTH, muscleGroup: "背" },
  { name: "宽距高位下拉", category: STRENGTH, muscleGroup: "背" },
  { name: "反手高位下拉", category: STRENGTH, muscleGroup: "背" },
  { name: "杠铃划船", category: STRENGTH, muscleGroup: "背" },
  { name: "哑铃划船", category: STRENGTH, muscleGroup: "背" },
  { name: "单臂哑铃划船", category: STRENGTH, muscleGroup: "背" },
  { name: "坐姿绳索划船", category: STRENGTH, muscleGroup: "背" },
  { name: "T杠划船", category: STRENGTH, muscleGroup: "背" },
  { name: "直臂下压", category: STRENGTH, muscleGroup: "背" },
  { name: "杠铃硬拉", category: STRENGTH, muscleGroup: "背" },
  { name: "罗马尼亚硬拉", category: STRENGTH, muscleGroup: "背" },
  { name: "相扑硬拉", category: STRENGTH, muscleGroup: "背" },
  { name: "面拉", category: STRENGTH, muscleGroup: "背" },
  // 肩(10)
  { name: "站姿杠铃推举", category: STRENGTH, muscleGroup: "肩" },
  { name: "坐姿哑铃推举", category: STRENGTH, muscleGroup: "肩" },
  { name: "阿诺德推举", category: STRENGTH, muscleGroup: "肩" },
  { name: "哑铃侧平举", category: STRENGTH, muscleGroup: "肩" },
  { name: "哑铃前平举", category: STRENGTH, muscleGroup: "肩" },
  { name: "哑铃反向飞鸟", category: STRENGTH, muscleGroup: "肩" },
  { name: "杠铃直立划船", category: STRENGTH, muscleGroup: "肩" },
  { name: "绳索侧平举", category: STRENGTH, muscleGroup: "肩" },
  { name: "史密斯推肩", category: STRENGTH, muscleGroup: "肩" },
  { name: "杠铃片前平举", category: STRENGTH, muscleGroup: "肩" },
  // 手臂(12)
  { name: "杠铃弯举", category: STRENGTH, muscleGroup: "手臂" },
  { name: "哑铃弯举", category: STRENGTH, muscleGroup: "手臂" },
  { name: "锤式弯举", category: STRENGTH, muscleGroup: "手臂" },
  { name: "上斜哑铃弯举", category: STRENGTH, muscleGroup: "手臂" },
  { name: "牧师凳弯举", category: STRENGTH, muscleGroup: "手臂" },
  { name: "绳索弯举", category: STRENGTH, muscleGroup: "手臂" },
  { name: "绳索下压", category: STRENGTH, muscleGroup: "手臂" },
  { name: "仰卧臂屈伸", category: STRENGTH, muscleGroup: "手臂" },
  { name: "窄距卧推", category: STRENGTH, muscleGroup: "手臂" },
  { name: "过头顶绳索臂屈伸", category: STRENGTH, muscleGroup: "手臂" },
  { name: "杠铃腕弯举", category: STRENGTH, muscleGroup: "手臂" },
  { name: "反握杠铃弯举", category: STRENGTH, muscleGroup: "手臂" },
  // 腿(16)
  { name: "杠铃深蹲", category: STRENGTH, muscleGroup: "腿" },
  { name: "杠铃前蹲", category: STRENGTH, muscleGroup: "腿" },
  { name: "高脚杯深蹲", category: STRENGTH, muscleGroup: "腿" },
  { name: "保加利亚分腿蹲", category: STRENGTH, muscleGroup: "腿" },
  { name: "杠铃箭步蹲", category: STRENGTH, muscleGroup: "腿" },
  { name: "哑铃箭步蹲", category: STRENGTH, muscleGroup: "腿" },
  { name: "腿举", category: STRENGTH, muscleGroup: "腿" },
  { name: "哈克深蹲", category: STRENGTH, muscleGroup: "腿" },
  { name: "坐姿腿屈伸", category: STRENGTH, muscleGroup: "腿" },
  { name: "俯卧腿弯举", category: STRENGTH, muscleGroup: "腿" },
  { name: "臀桥", category: BODYWEIGHT, muscleGroup: "腿" },
  { name: "杠铃臀推", category: STRENGTH, muscleGroup: "腿" },
  { name: "站姿提踵", category: STRENGTH, muscleGroup: "腿" },
  { name: "坐姿提踵", category: STRENGTH, muscleGroup: "腿" },
  { name: "坐姿髋内收", category: STRENGTH, muscleGroup: "腿" },
  { name: "坐姿髋外展", category: STRENGTH, muscleGroup: "腿" },
  // 核心(10)
  { name: "卷腹", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "反向卷腹", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "平板支撑", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "侧平板支撑", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "俄罗斯转体", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "悬垂举腿", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "健腹轮", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "死虫式", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "鸟狗式", category: BODYWEIGHT, muscleGroup: "核心" },
  { name: "仰卧交替抬腿", category: BODYWEIGHT, muscleGroup: "核心" },
  // 有氧(6)
  { name: "跑步机慢跑", category: CARDIO, muscleGroup: "有氧" },
  { name: "椭圆机", category: CARDIO, muscleGroup: "有氧" },
  { name: "动感单车", category: CARDIO, muscleGroup: "有氧" },
  { name: "跳绳", category: CARDIO, muscleGroup: "有氧" },
  { name: "划船机", category: CARDIO, muscleGroup: "有氧" },
  { name: "爬楼机", category: CARDIO, muscleGroup: "有氧" },
];

type FoodSeed = {
  name: string;
  kcalPer100: number;
  proteinPer100: string;
  carbsPer100: string;
  fatPer100: string;
  isLiquid?: boolean;
};

const FOODS: FoodSeed[] = [
  // 肉蛋水产
  { name: "鸡胸肉(生)", kcalPer100: 118, proteinPer100: "23.0", carbsPer100: "0.5", fatPer100: "2.0" },
  { name: "鸡蛋(全蛋)", kcalPer100: 144, proteinPer100: "12.6", carbsPer100: "1.5", fatPer100: "9.5" },
  { name: "鸡蛋白", kcalPer100: 52, proteinPer100: "11.0", carbsPer100: "0.7", fatPer100: "0.2" },
  { name: "牛里脊(生)", kcalPer100: 107, proteinPer100: "22.2", carbsPer100: "0.5", fatPer100: "1.5" },
  { name: "猪里脊(生)", kcalPer100: 155, proteinPer100: "20.2", carbsPer100: "1.5", fatPer100: "7.9" },
  { name: "三文鱼(生)", kcalPer100: 139, proteinPer100: "17.2", carbsPer100: "0.0", fatPer100: "7.8" },
  { name: "金枪鱼(水浸罐头)", kcalPer100: 116, proteinPer100: "25.5", carbsPer100: "0.0", fatPer100: "0.8" },
  { name: "基围虾(生)", kcalPer100: 101, proteinPer100: "18.2", carbsPer100: "3.9", fatPer100: "1.4" },
  { name: "牛腱肉(生)", kcalPer100: 98, proteinPer100: "20.3", carbsPer100: "1.2", fatPer100: "1.3" },
  { name: "鸭胸肉(生)", kcalPer100: 90, proteinPer100: "19.0", carbsPer100: "0.4", fatPer100: "1.5" },
  // 主食
  { name: "米饭(熟)", kcalPer100: 116, proteinPer100: "2.6", carbsPer100: "25.9", fatPer100: "0.3" },
  { name: "糙米饭(熟)", kcalPer100: 112, proteinPer100: "2.6", carbsPer100: "23.5", fatPer100: "0.9" },
  { name: "面条(熟)", kcalPer100: 110, proteinPer100: "3.6", carbsPer100: "22.8", fatPer100: "0.6" },
  { name: "全麦面包", kcalPer100: 246, proteinPer100: "9.0", carbsPer100: "45.0", fatPer100: "3.5" },
  { name: "白面包", kcalPer100: 265, proteinPer100: "8.0", carbsPer100: "50.0", fatPer100: "3.0" },
  { name: "燕麦片(干)", kcalPer100: 367, proteinPer100: "13.5", carbsPer100: "61.0", fatPer100: "6.7" },
  { name: "红薯(熟)", kcalPer100: 90, proteinPer100: "2.0", carbsPer100: "20.7", fatPer100: "0.2" },
  { name: "土豆(熟)", kcalPer100: 87, proteinPer100: "1.9", carbsPer100: "20.1", fatPer100: "0.1" },
  { name: "玉米(鲜)", kcalPer100: 112, proteinPer100: "4.0", carbsPer100: "22.8", fatPer100: "1.2" },
  { name: "藜麦(熟)", kcalPer100: 120, proteinPer100: "4.4", carbsPer100: "21.3", fatPer100: "1.9" },
  { name: "荞麦面条(熟)", kcalPer100: 99, proteinPer100: "5.1", carbsPer100: "21.0", fatPer100: "0.5" },
  { name: "馒头", kcalPer100: 223, proteinPer100: "7.0", carbsPer100: "47.0", fatPer100: "1.1" },
  // 乳制品与豆制品
  { name: "全脂牛奶", kcalPer100: 65, proteinPer100: "3.3", carbsPer100: "5.0", fatPer100: "3.6", isLiquid: true },
  { name: "脱脂牛奶", kcalPer100: 34, proteinPer100: "3.4", carbsPer100: "5.0", fatPer100: "0.1", isLiquid: true },
  { name: "无糖酸奶", kcalPer100: 62, proteinPer100: "5.0", carbsPer100: "5.0", fatPer100: "3.0" },
  { name: "希腊酸奶(脱脂)", kcalPer100: 59, proteinPer100: "10.2", carbsPer100: "3.6", fatPer100: "0.4" },
  { name: "北豆腐", kcalPer100: 116, proteinPer100: "12.2", carbsPer100: "2.0", fatPer100: "4.8" },
  { name: "嫩豆腐", kcalPer100: 62, proteinPer100: "6.2", carbsPer100: "2.5", fatPer100: "2.5" },
  { name: "豆浆(无糖)", kcalPer100: 31, proteinPer100: "3.0", carbsPer100: "1.2", fatPer100: "1.6", isLiquid: true },
  { name: "腐竹(干)", kcalPer100: 461, proteinPer100: "44.6", carbsPer100: "22.3", fatPer100: "21.7" },
  // 蔬菜
  { name: "西兰花", kcalPer100: 36, proteinPer100: "4.1", carbsPer100: "4.3", fatPer100: "0.6" },
  { name: "菠菜", kcalPer100: 28, proteinPer100: "2.6", carbsPer100: "4.5", fatPer100: "0.3" },
  { name: "生菜", kcalPer100: 15, proteinPer100: "1.3", carbsPer100: "2.0", fatPer100: "0.3" },
  { name: "番茄", kcalPer100: 20, proteinPer100: "0.9", carbsPer100: "4.0", fatPer100: "0.2" },
  { name: "黄瓜", kcalPer100: 16, proteinPer100: "0.8", carbsPer100: "2.9", fatPer100: "0.2" },
  { name: "胡萝卜", kcalPer100: 39, proteinPer100: "1.0", carbsPer100: "8.8", fatPer100: "0.2" },
  { name: "芦笋", kcalPer100: 22, proteinPer100: "2.4", carbsPer100: "3.9", fatPer100: "0.2" },
  { name: "蘑菇(鲜)", kcalPer100: 24, proteinPer100: "2.7", carbsPer100: "4.1", fatPer100: "0.3" },
  // 水果
  { name: "苹果", kcalPer100: 53, proteinPer100: "0.4", carbsPer100: "13.5", fatPer100: "0.2" },
  { name: "香蕉", kcalPer100: 93, proteinPer100: "1.1", carbsPer100: "22.0", fatPer100: "0.2" },
  { name: "橙子", kcalPer100: 48, proteinPer100: "0.8", carbsPer100: "11.1", fatPer100: "0.2" },
  { name: "蓝莓", kcalPer100: 57, proteinPer100: "0.7", carbsPer100: "14.5", fatPer100: "0.3" },
  { name: "西瓜", kcalPer100: 26, proteinPer100: "0.5", carbsPer100: "5.8", fatPer100: "0.3" },
  // 坚果油脂
  { name: "花生(熟)", kcalPer100: 589, proteinPer100: "24.0", carbsPer100: "21.0", fatPer100: "47.0" },
  { name: "杏仁(生)", kcalPer100: 579, proteinPer100: "21.0", carbsPer100: "22.0", fatPer100: "50.0" },
  { name: "核桃(干)", kcalPer100: 646, proteinPer100: "14.9", carbsPer100: "9.6", fatPer100: "58.8" },
  { name: "橄榄油", kcalPer100: 899, proteinPer100: "0.0", carbsPer100: "0.0", fatPer100: "99.9" },
  // 补充蛋白
  { name: "乳清蛋白粉(勺约30g)", kcalPer100: 400, proteinPer100: "80.0", carbsPer100: "8.0", fatPer100: "6.0" },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (check .env)");
    process.exit(1);
  }

  const sqlClient = neon(process.env.DATABASE_URL);
  const db = drizzle(sqlClient);

  const [existingExercises] = await db
    .select({ value: count() })
    .from(exercises)
    .where(isNull(exercises.ownerId));
  if (existingExercises.value > 0) {
    console.log(`官方动作库已存在 ${existingExercises.value} 条,跳过`);
  } else {
    await db.insert(exercises).values(EXERCISES);
    console.log(`动作库:已插入 ${EXERCISES.length} 条官方动作`);
  }

  const [existingFoods] = await db
    .select({ value: count() })
    .from(foods)
    .where(isNull(foods.ownerId));
  if (existingFoods.value > 0) {
    console.log(`官方食物库已存在 ${existingFoods.value} 条,跳过`);
  } else {
    await db.insert(foods).values(FOODS);
    console.log(`食物库:已插入 ${FOODS.length} 条官方食物`);
  }

  const [totalExercises] = await db.select({ value: count() }).from(exercises).where(isNull(exercises.ownerId));
  const [totalFoods] = await db.select({ value: count() }).from(foods).where(isNull(foods.ownerId));
  console.log(`完成:官方动作 ${totalExercises.value} 条,官方食物 ${totalFoods.value} 条`);
  console.log("提示:验证计数一致性 = ", EXERCISES.length === totalExercises.value && FOODS.length === totalFoods.value ? "一致" : "不一致!");
}

main().catch((err) => {
  console.error("Seed 失败:", err);
  process.exit(1);
});
