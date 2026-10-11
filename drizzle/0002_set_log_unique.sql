-- ============================================================
-- Batch 2A:set_logs 增加 (session_id, training_item_id, set_index) 唯一约束
-- 目的:消除历史脏数据(同会话/动作/组号 多行),并守住未来并发/超时场景。
-- 应用层 logSet 已有幂等覆盖逻辑(training-sessions.ts#logSet),本迁移为
-- DB 层最后一道防线。
--
-- 合并策略权威行优先级:
--   1) completed = true(用户已勾完成 = 主意图)
--   2) completed_at 最新(最近一次提交)
--   3) id 最小(确定性兜底)
-- ============================================================

-- 0) 备份全表(供运营/回滚);IF NOT EXISTS 防止二次执行
CREATE TABLE IF NOT EXISTS set_logs_dedup_backup_20261011 AS
  SELECT * FROM set_logs;

-- 1) 删重复组中"非权威"行(行号 > 1 的都是冗余)
--    选用 row_number() + DELETE USING 写法,大数据量下避免子查询 IN(...) 的
--    hash 膨胀问题。
DELETE FROM set_logs a
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY session_id, training_item_id, set_index
           ORDER BY completed DESC,
                    completed_at DESC NULLS LAST,
                    id ASC
         ) AS rn
  FROM set_logs
) b
WHERE a.id = b.id
  AND b.rn > 1;

-- 2) 加唯一约束(约束名与 src/db/schema.ts setLogs uniqueIndex 一致)
--    注意:Drizzle 同步会同时建 unique index;本迁移用 CONSTRAINT 形式,
--    后续若跑 drizzle-kit push 会发现约束已存在 → 幂等不报错。
ALTER TABLE set_logs
  ADD CONSTRAINT set_log_session_item_index_unique
  UNIQUE (session_id, training_item_id, set_index);
