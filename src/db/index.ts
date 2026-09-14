/**
 * 数据库连接(ADR-2:Neon + neon-http 驱动)
 *
 * 每次查询独立 HTTP 请求,免连接池——serverless(Vercel 开发/EdgeOne 生产)官方推荐。
 * 红线:本驱动不支持 db.transaction(无事务 API);需要原子多写时用 db.batch,
 * 多语句打包为单次 HTTP 请求,由 Neon 服务端在单个事务内执行。
 * 服务层统一从 lib/db/queries 导入本实例,页面/API 层禁止直接使用(分层红线)。
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (check .env)");
}

const sqlClient = neon(process.env.DATABASE_URL);

export const db = drizzle(sqlClient, { schema });

export { schema };
