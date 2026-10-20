/**
 * The only place the seva charts touch the ECharts runtime (DESIGN-BOOK 12.5, R5 s4).
 * Modular `echarts/core` with just the series and components the dashboard and reports use, and the SVG renderer.
 * Import this from client components only (it is pulled in by components/charts/EChart.tsx, loaded with next/dynamic).
 */
import { BarChart, HeatmapChart, LineChart, PieChart, TreemapChart } from "echarts/charts";
import {
  CalendarComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  HeatmapChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  CalendarComponent,
  DatasetComponent,
  SVGRenderer,
]);

export { echarts };
export type { EChartsCoreOption, EChartsType } from "echarts/core";
