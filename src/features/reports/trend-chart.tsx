"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  day: string; // "Mon 4"
  count: number;
}

/**
 * Single-series activity trend. One hue (validated chart-1), thin bars with
 * rounded data-ends, recessive grid, hover tooltip. No legend — the section
 * title names the series.
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Activity per day">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              color: "var(--color-popover-foreground)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-muted-foreground)" }}
            formatter={(value) => [`${value ?? 0} events`, null]}
          />
          <Bar
            dataKey="count"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            name="Activity"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
