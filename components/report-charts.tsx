"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ReportCharts({ rows }: { rows: { name: string; performed: number; missed: number }[] }) {
  return <div className="h-[220px] w-full" aria-label="Grafik perbandingan salat terlaksana dan tidak terlaksana"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: -20 }} barGap={4}><CartesianGrid vertical={false} stroke="#edf1ed" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#748078", fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#849087", fontSize: 10 }} /><Tooltip cursor={{ fill: "#f7f9f7" }} contentStyle={{ border: "1px solid #e7ece8", borderRadius: 12, fontSize: 11 }} /><Bar dataKey="performed" name="Melaksanakan" fill="#43815a" radius={[4, 4, 0, 0]} maxBarSize={28} /><Bar dataKey="missed" name="Tidak melaksanakan" fill="#c94b41" radius={[4, 4, 0, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>;
}
