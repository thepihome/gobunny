import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useChartColors } from '../utils/chartColors';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="chart-tooltip">
      <strong>{label || entry?.name}</strong>
      <span className="chart-tooltip-value">
        {entry?.value ?? entry?.payload?.hours ?? entry?.payload?.matches}
      </span>
    </div>
  );
}

function DashboardChart({ chart }) {
  const colors = useChartColors();
  const [activeIndex, setActiveIndex] = useState(null);

  const tickStyle = { fontSize: 11, fill: colors.text };
  const axisProps = {
    tick: tickStyle,
    axisLine: { stroke: colors.grid },
    tickLine: { stroke: colors.grid },
  };

  if (!chart?.data?.length) {
    return (
      <div className="chart-card chart-card--empty">
        <h3>{chart.title}</h3>
        <p>No data available yet</p>
      </div>
    );
  }

  const getFill = (entry, i) => entry.fill || colors.palette[i % colors.palette.length];

  const renderChart = () => {
    switch (chart.type) {
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chart.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="42%"
              outerRadius="72%"
              paddingAngle={3}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chart.data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={getFill(entry, i)}
                  stroke={colors.surface}
                  strokeWidth={2}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.45}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: colors.text }}
              formatter={(value) => <span style={{ color: colors.heading }}>{value}</span>}
            />
          </PieChart>
        );

      case 'line': {
        const key = chart.dataKey || 'value';
        return (
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: colors.primary, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Line
              type="monotone"
              dataKey={key}
              stroke={colors.primary}
              strokeWidth={2.5}
              dot={{ fill: colors.primary, stroke: colors.surface, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: colors.primaryLight, stroke: colors.surface, strokeWidth: 2 }}
            />
          </LineChart>
        );
      }

      case 'bar':
      default:
        return (
          <BarChart data={chart.data} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="name"
              {...axisProps}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: `color-mix(in srgb, ${colors.primary} 8%, transparent)` }}
            />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chart.data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={getFill(entry, i)}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.55}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                />
              ))}
            </Bar>
          </BarChart>
        );
    }
  };

  return (
    <div className="chart-card">
      <h3>{chart.title}</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardCharts({ charts, isLoading }) {
  if (isLoading) {
    return <div className="dashboard-section-loading">Loading analytics...</div>;
  }

  if (!charts?.length) {
    return (
      <div className="dashboard-empty-charts">
        <p>No analytics available for your role yet.</p>
      </div>
    );
  }

  return (
    <div className="charts-grid">
      {charts.map((chart) => (
        <DashboardChart key={chart.id} chart={chart} />
      ))}
    </div>
  );
}
