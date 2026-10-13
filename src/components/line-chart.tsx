"use client";

/**
 * 极简 SVG 折线图(V1.0 PRD 评审:3.11 P2 仍可 V1.x,但此处提前接入轻量版)
 *
 * - 零依赖,纯 SVG path
 * - 数据点 ≥2 才画线,否则显示空态
 * - Y 轴自适应 + padding,标签 4 段
 * - 末尾点高亮(最新值)
 */
interface Series {
  name: string;
  points: Array<{ date: string; value: number }>;
  color: string; // 描边/点色
  unit: string;
}

interface Props {
  series: Series[];
  height?: number;
  yMin?: number;
  yMax?: number;
  /** Y 轴标签精度(小数位),默认 1 */
  yPrecision?: number;
}

function normalize(values: number[], padding = 0.1): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return { min: lo - 1, max: hi + 1 };
  const range = hi - lo;
  return { min: lo - range * padding, max: hi + range * padding };
}

export function LineChart({
  series,
  height = 180,
  yMin,
  yMax,
  yPrecision = 1,
}: Props) {
  if (series.length === 0 || series.every((s) => s.points.length < 2)) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground"
        style={{ height }}
      >
        数据不足,至少需要 2 个点
      </div>
    );
  }

  // 统一 X 轴 = 第一个 series 的日期(其他 series 视为同维度)
  const baseSeries = series[0];
  const baseLen = baseSeries.points.length;
  if (baseLen < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground"
        style={{ height }}
      >
        数据不足,至少需要 2 个点
      </div>
    );
  }

  // Y 范围:自动或指定
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const auto = normalize(allValues, 0.1);
  const yLo = yMin ?? auto.min;
  const yHi = yMax ?? auto.max;
  const yRange = yHi - yLo || 1;

  const W = 100;
  const H = 100;
  function toY(v: number): number {
    return H - ((v - yLo) / yRange) * H;
  }
  function toX(i: number): number {
    return baseLen === 1 ? W / 2 : (i / (baseLen - 1)) * W;
  }

  // 4 条水平 grid + Y 标签
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    pos: H * p,
    val: yHi - yRange * p,
  }));

  // X 标签:首/末 + 1/3 / 2/3 处
  const xLabelIdxs = baseLen <= 4
    ? Array.from({ length: baseLen }, (_, i) => i)
    : [0, Math.floor((baseLen - 1) / 3), Math.floor((2 * (baseLen - 1)) / 3), baseLen - 1];

  return (
    <div className="rounded-lg border bg-card p-3">
      <svg
        viewBox={`-6 -6 ${W + 12} ${H + 18}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* Y 网格 + 标签 */}
        {yLabels.map((y, i) => (
          <g key={i}>
            <line
              x1={0}
              y1={y.pos}
              x2={W}
              y2={y.pos}
              stroke="currentColor"
              className="text-border"
              strokeWidth={0.3}
              strokeDasharray="1 1"
            />
            <text
              x={-2}
              y={y.pos + 1.2}
              textAnchor="end"
              fontSize={3.5}
              className="fill-muted-foreground"
            >
              {y.val.toFixed(yPrecision)}
            </text>
          </g>
        ))}

        {/* X 标签(日期) */}
        {xLabelIdxs.map((i) => {
          const date = baseSeries.points[i]?.date.slice(5) ?? "";
          return (
            <text
              key={i}
              x={toX(i)}
              y={H + 6}
              textAnchor="middle"
              fontSize={3.2}
              className="fill-muted-foreground"
            >
              {date}
            </text>
          );
        })}

        {/* 各 series 折线 + 末尾点 */}
        {series.map((s) => {
          // 对齐到 baseSeries 的日期:缺失位置 null(断开)
          const baseDates = new Set(baseSeries.points.map((p) => p.date));
          const aligned = s.points.filter((p) => baseDates.has(p.date));
          if (aligned.length < 2) return null;

          const d = aligned
            .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(baseSeries.points.findIndex((bp) => bp.date === p.date))} ${toY(p.value)}`)
            .join(" ");
          const last = aligned[aligned.length - 1];
          const lastX = toX(baseSeries.points.findIndex((bp) => bp.date === last.date));
          const lastY = toY(last.value);
          return (
            <g key={s.name}>
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={lastX} cy={lastY} r={1.4} fill={s.color} />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.name}({s.unit})
          </span>
        ))}
      </div>
    </div>
  );
}
