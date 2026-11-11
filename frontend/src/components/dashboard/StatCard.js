import React from "react";

const colorMap = {
  blue: "route",
  route: "route",
  green: "live",
  purple: "signal",
  orange: "attention",
};

export default function StatCard({
  icon: Icon,
  value,
  label,
  color = "blue",
  trend,
  trendLabel,
}) {
  const tone = colorMap[color] || "route";
  const isUp = trend === "up";
  const isDown = trend === "down";

  return (
    <article className={`vt-dashboard-stat vt-dashboard-stat--${tone}`}>
      <div className="vt-dashboard-stat-head">
        <span className="vt-dashboard-stat-icon"><Icon size={18} strokeWidth={1.9} aria-hidden="true" /></span>
        {trendLabel && (
          <span className={`vt-dashboard-stat-chip${isUp ? " is-up" : ""}${isDown ? " is-down" : ""}`}>
            {isUp ? "↑ " : isDown ? "↓ " : ""}
            {trendLabel}
          </span>
        )}
      </div>
      <div className="vt-dashboard-stat-copy">
        <span className="vt-dashboard-stat-label">{label}</span>
        <strong className="vt-dashboard-stat-value">{value}</strong>
      </div>
    </article>
  );
}
