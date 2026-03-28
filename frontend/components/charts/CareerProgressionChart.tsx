'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Plus, Trash2 } from 'lucide-react';

export interface SalaryPoint {
  age: number;
  salary: number;
  label?: string;
}

export interface BenchmarkLine {
  label: string;
  data: { age: number; salary: number; levelLabel?: string }[];
  color?: string;
}

// Default annual raise applied within each "step" (between user milestones)
const DEFAULT_ANNUAL_RAISE = 0.03; // 3% per year

interface Props {
  points: SalaryPoint[];
  onChange: (points: SalaryPoint[]) => void;
  currentAge: number;
  benchmarkLines?: BenchmarkLine[];
  annualRaisePct?: number; // override default annual raise between milestones
}

const formatSalary = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
};

const BENCHMARK_COLORS = ['#f97316', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];

const DOT_RADIUS = 14;
const DOT_RADIUS_ACTIVE = 18;

export default function CareerProgressionChart({ points, onChange, currentAge, benchmarkLines = [], annualRaisePct }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // We store only the pixel layout (left/right/top/bottom of the plot area).
  // Domain values (min/max age/salary) are read live from component scope so
  // dot positions update instantly when career path changes without waiting for DOM recapture.
  const pixelLayoutRef = useRef<{
    left: number; right: number; top: number; bottom: number;
  } | null>(null);

  // Compute chart domains (include benchmark salaries for Y range)
  const allSalaries = [
    ...points.map((p) => p.salary),
    ...benchmarkLines.flatMap((bl) => bl.data.map((d) => d.salary)),
  ];
  const minSalary = 0;
  const maxSalary = Math.max(...allSalaries, 50000) * 1.3;

  const sorted = [...points].sort((a, b) => a.age - b.age);
  const minAge = Math.min(currentAge, sorted[0]?.age ?? currentAge);
  const maxAge = Math.max(70, sorted[sorted.length - 1]?.age ?? 65);

  // Step function with annual raise: salary stays at milestone level + compounds
  // by DEFAULT_ANNUAL_RAISE each year until the next milestone jump
  const stepWithRaise = (pts: { age: number; salary: number }[], age: number): number | undefined => {
    if (pts.length === 0) return undefined;
    if (age < pts[0].age) return pts[0].salary;

    // Find which milestone we're in
    let base = pts[0];
    for (let i = pts.length - 1; i >= 0; i--) {
      if (age >= pts[i].age) {
        base = pts[i];
        break;
      }
    }
    const raise = annualRaisePct !== undefined ? annualRaisePct / 100 : DEFAULT_ANNUAL_RAISE;
    const yearsInLevel = age - base.age;
    return Math.round(base.salary * Math.pow(1 + raise, yearsInLevel));
  };

  // Step function for benchmarks (no raise between levels — flat steps)
  const stepFlat = (pts: { age: number; salary: number }[], age: number): number | undefined => {
    if (pts.length === 0) return undefined;
    if (age < pts[0].age) return pts[0].salary;
    let val = pts[0].salary;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (age >= pts[i].age) {
        val = pts[i].salary;
        break;
      }
    }
    return val;
  };

  // Build chart data: user line (step + raise) and benchmark lines (flat step)
  const interpolated: Record<string, number>[] = [];
  for (let age = minAge; age <= maxAge; age++) {
    const row: Record<string, number> = {
      age,
      salary: stepWithRaise(sorted, age) ?? sorted[0]?.salary ?? 0,
    };
    benchmarkLines.forEach((bl, idx) => {
      const sortedBl = [...bl.data].sort((a, b) => a.age - b.age);
      const val = stepFlat(sortedBl, age);
      if (val !== undefined) row[`benchmark_${idx}`] = val;
    });
    interpolated.push(row);
  }

  // Collect benchmark level transition labels for SVG overlay
  const benchmarkLabels: { age: number; salary: number; label: string; color: string }[] = [];
  benchmarkLines.forEach((bl, idx) => {
    const color = bl.color || BENCHMARK_COLORS[idx % BENCHMARK_COLORS.length];
    bl.data.forEach((d) => {
      if (d.levelLabel) {
        benchmarkLabels.push({ age: d.age, salary: d.salary, label: d.levelLabel, color });
      }
    });
  });

  // Capture only the pixel layout of the plot area (stable across data changes).
  const captureChartBounds = useCallback(() => {
    if (!containerRef.current) return;
    const grid = containerRef.current.querySelector('.recharts-cartesian-grid');
    if (!grid) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    pixelLayoutRef.current = {
      left: gridRect.left - containerRect.left,
      right: gridRect.right - containerRect.left,
      top: gridRect.top - containerRect.top,
      bottom: gridRect.bottom - containerRect.top,
    };
  }, []);

  // Capture pixel layout on mount and resize only — domain values are read live.
  useEffect(() => {
    captureChartBounds();
    window.addEventListener('resize', captureChartBounds);
    return () => window.removeEventListener('resize', captureChartBounds);
  }, [captureChartBounds]);

  // Re-capture after first render (Recharts needs one paint to size the grid).
  useEffect(() => {
    const t = setTimeout(captureChartBounds, 100);
    return () => clearTimeout(t);
  }, [captureChartBounds]);

  // Map data coords to pixel coords — domain values read live so dots reposition
  // instantly when salary scale changes (e.g. switching career paths).
  const dataToPixel = (age: number, salary: number) => {
    const layout = pixelLayoutRef.current;
    if (!layout) return { x: 0, y: 0 };
    const xPct = (age - minAge) / (maxAge - minAge);
    const yPct = (salary - minSalary) / (maxSalary - minSalary);
    return {
      x: layout.left + xPct * (layout.right - layout.left),
      y: layout.bottom - yPct * (layout.bottom - layout.top),
    };
  };

  const pixelToData = (px: number, py: number) => {
    const layout = pixelLayoutRef.current;
    if (!layout) return { age: currentAge, salary: 0 };
    const xPct = (px - layout.left) / (layout.right - layout.left);
    const yPct = 1 - (py - layout.top) / (layout.bottom - layout.top);
    return {
      age: Math.round(minAge + xPct * (maxAge - minAge)),
      salary: Math.round((minSalary + yPct * (maxSalary - minSalary)) / 1000) * 1000,
    };
  };

  // Drag handlers
  const handleDotMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex(index);
    setDragging(true);
    captureChartBounds();
  }, [captureChartBounds]);

  useEffect(() => {
    if (!dragging || activeIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const relX = e.clientX - containerRect.left;
      const relY = e.clientY - containerRect.top;
      const { age, salary } = pixelToData(relX, relY);
      const isFirstPoint = points[activeIndex].age === Math.min(...points.map((p) => p.age));
      const clampedAge = isFirstPoint ? currentAge : Math.max(currentAge, Math.min(85, age));

      const updated = [...points];
      updated[activeIndex] = { ...updated[activeIndex], age: clampedAge, salary: Math.max(0, salary) };
      onChange(updated);
    };

    const handleMouseUp = () => {
      setDragging(false);
      setActiveIndex(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, activeIndex, points, onChange]);

  // Click on chart to add a point
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) return;
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const relX = e.clientX - containerRect.left;
      const relY = e.clientY - containerRect.top;
      const { age, salary } = pixelToData(relX, relY);

      // Don't add if outside plot area or too close to existing point
      const layout = pixelLayoutRef.current;
      if (!layout) return;
      if (relX < layout.left || relX > layout.right || relY < layout.top || relY > layout.bottom) return;
      if (points.some((p) => Math.abs(p.age - age) < 2)) return;

      const updated = [...points, { age, salary: Math.max(0, salary), label: '' }]
        .sort((a, b) => a.age - b.age);
      onChange(updated);
    },
    [dragging, points, onChange]
  );

  const removePoint = (index: number) => {
    if (points.length <= 1) return;
    onChange(points.filter((_, i) => i !== index));
  };

  const updatePoint = (index: number, field: 'age' | 'salary', value: number) => {
    const updated = [...points];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated.sort((a, b) => a.age - b.age));
  };

  const updateLabel = (index: number, label: string) => {
    const updated = [...points];
    updated[index] = { ...updated[index], label };
    onChange(updated);
  };

  const addPoint = () => {
    const last = sorted[sorted.length - 1];
    const newAge = Math.min((last?.age || currentAge) + 5, 70);
    const newSalary = Math.round((last?.salary || 50000) * 1.2);
    const updated = [...points, { age: newAge, salary: newSalary, label: '' }].sort((a, b) => a.age - b.age);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Chart with overlay dots */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-600">
            Salary Progression — <span className="text-blue-600">drag points to adjust, click chart to add</span>
          </p>
        </div>
        <div
          ref={containerRef}
          className="relative h-80"
          style={{ userSelect: 'none' }}
        >
          {/* Recharts line chart (no dots — we render our own) */}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={interpolated}
              margin={{ top: 30, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 11 }}
                tickLine={false}
                label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
              />
              <YAxis
                tickFormatter={formatSalary}
                tick={{ fontSize: 11 }}
                tickLine={false}
                domain={[minSalary, maxSalary]}
                width={55}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Salary']}
                labelFormatter={(age) => `Age ${age}`}
              />
              <Line
                type="monotone"
                dataKey="salary"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                name="Your Path"
                isAnimationActive={false}
              />
              {benchmarkLines.map((bl, idx) => (
                <Line
                  key={idx}
                  type="stepAfter"
                  dataKey={`benchmark_${idx}`}
                  stroke={bl.color || BENCHMARK_COLORS[idx % BENCHMARK_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={false}
                  name={bl.label}
                  isAnimationActive={false}
                />
              ))}
              {benchmarkLines.length > 0 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            </LineChart>
          </ResponsiveContainer>

          {/* Transparent click overlay (behind dots, above chart) */}
          <div
            className="absolute inset-0"
            style={{ zIndex: 10 }}
            onClick={handleOverlayClick}
          />

          {/* Draggable dot overlay */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 20, overflow: 'visible' }}
            width="100%"
            height="100%"
          >
            {sorted.map((point, i) => {
              const pos = dataToPixel(point.age, point.salary);
              const isActive = activeIndex === i;
              const isHover = hoverIndex === i;
              const r = isActive ? DOT_RADIUS_ACTIVE : isHover ? DOT_RADIUS + 2 : DOT_RADIUS;

              return (
                <g key={i} style={{ pointerEvents: 'auto' }}>
                  {/* Larger invisible hit area */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 8}
                    fill="transparent"
                    style={{ cursor: 'move' }}
                    onMouseDown={(e) => handleDotMouseDown(e, i)}
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                  {/* Outer glow ring */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 4}
                    fill="none"
                    stroke={isActive ? '#2563eb' : '#93c5fd'}
                    strokeWidth={2}
                    opacity={isActive || isHover ? 0.5 : 0}
                    style={{ transition: 'opacity 0.15s, r 0.15s' }}
                  />
                  {/* Main dot */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={isActive ? '#1d4ed8' : '#3b82f6'}
                    stroke="#fff"
                    strokeWidth={3}
                    style={{
                      cursor: 'move',
                      transition: 'r 0.15s, fill 0.15s',
                      filter: isActive ? 'drop-shadow(0 2px 8px rgba(37, 99, 235, 0.5))' : isHover ? 'drop-shadow(0 2px 6px rgba(37, 99, 235, 0.3))' : 'none',
                    }}
                    onMouseDown={(e) => handleDotMouseDown(e, i)}
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                  {/* Grip icon inside dot (two vertical lines) */}
                  <line x1={pos.x - 3} y1={pos.y - 4} x2={pos.x - 3} y2={pos.y + 4} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                  <line x1={pos.x} y1={pos.y - 4} x2={pos.x} y2={pos.y + 4} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                  <line x1={pos.x + 3} y1={pos.y - 4} x2={pos.x + 3} y2={pos.y + 4} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                  {/* Label above dot */}
                  <text
                    x={pos.x}
                    y={pos.y - r - 8}
                    textAnchor="middle"
                    fill="#1e40af"
                    fontSize={12}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {point.label || `Age ${point.age}`}
                  </text>
                </g>
              );
            })}

            {/* Benchmark level transition labels */}
            {benchmarkLabels.map((bl, i) => {
              const pos = dataToPixel(bl.age, bl.salary);
              return (
                <g key={`bl-${i}`} style={{ pointerEvents: 'none' }}>
                  {/* Small diamond marker at transition */}
                  <rect
                    x={pos.x - 4}
                    y={pos.y - 4}
                    width={8}
                    height={8}
                    rx={1}
                    fill={bl.color}
                    transform={`rotate(45 ${pos.x} ${pos.y})`}
                  />
                  {/* Level label */}
                  <text
                    x={pos.x + 8}
                    y={pos.y - 6}
                    textAnchor="start"
                    fill={bl.color}
                    fontSize={10}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {bl.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Editable Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-600">Career Milestones</p>
          <button
            onClick={addPoint}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Milestone
          </button>
        </div>
        <div className="space-y-2">
          {sorted.map((point, i) => {
            const originalIndex = points.findIndex((p) => p === point);
            return (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="text"
                  value={point.label || ''}
                  onChange={(e) => updateLabel(originalIndex, e.target.value)}
                  placeholder="e.g. Senior SWE"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">Age</span>
                  <input
                    type="number"
                    value={point.age}
                    onChange={(e) => updatePoint(originalIndex, 'age', Number(e.target.value))}
                    min={currentAge}
                    max={70}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">$</span>
                  <input
                    type="number"
                    value={point.salary}
                    onChange={(e) => updatePoint(originalIndex, 'salary', Number(e.target.value))}
                    step={5000}
                    min={0}
                    className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right"
                  />
                </div>
                <button
                  onClick={() => removePoint(originalIndex)}
                  disabled={points.length <= 1}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
