import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { icons } from "./icons";
import { Logo } from "../Logo";
import useTrackingRoute from "./useTrackingRoute";

export default function Sidebar({ role, onLogout, trackingState: suppliedTrackingState }) {
  const location = useLocation();
  const navigate = useNavigate();
  const ownTrackingState = useTrackingRoute(role);
  const { trackingLink, trackingEnabled } = suppliedTrackingState || ownTrackingState;

  const navItems = [
    { id: "home", to: "/dashboard", icon: icons.dashboard, label: "Inicio" },
    {
      id: "driver-routes",
      to: "/driver/routes",
      icon: icons.routes,
      label: "Mis rutas",
      driver: true,
    },
    { id: "admin-users", to: "/admin/users", icon: icons.users, label: "Usuarios", admin: true },
    {
      id: "admin-drivers",
      to: "/admin/drivers",
      icon: icons.drivers,
      label: "Conductores",
      admin: true,
    },
    { id: "admin-routes", to: "/admin/routes", icon: icons.routes, label: "Rutas", admin: true },
    {
      id: "admin-passengers",
      to: "/admin/passengers",
      icon: icons.clipboard,
      label: "Estudiantes",
      admin: true,
    },
    {
      id: "tracking",
      to: trackingEnabled ? trackingLink : "/dashboard",
      icon: icons.tracking,
      label: "Tracking",
      disabled: !trackingEnabled,
      tracking: true,
    },
    { id: "profile", to: "/profile", icon: icons.profile, label: "Mi Perfil" },
  ];

  return (
    <aside className="sticky top-0 z-10 flex w-full shrink-0 flex-col border-b border-gray-200 bg-white px-2 py-2 shadow-sm md:min-h-screen md:w-60 md:border-b-0 md:border-r md:px-4 md:py-8">
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="mb-4 hidden cursor-pointer border-0 bg-transparent px-2 p-0 text-left md:mb-10 md:block"
      >
        <Logo variant="default" iconSize={30} />
      </button>
      <nav aria-label="Navegación principal" className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
        {navItems
          .filter(
            (item) =>
              (!item.admin || role === "admin") &&
              (!item.driver || role === "driver"),
          )
          .map((item, index) => {
            const Icon = item.icon;
            const isActive = item.tracking
              ? location.pathname.startsWith("/tracking/")
              : location.pathname === item.to;
            return (
              <Link
                key={item.id}
                to={item.to}
                onClick={
                  item.disabled ? (event) => event.preventDefault() : undefined
                }
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 font-medium text-sm transition-colors duration-150 md:gap-3 md:px-4 md:py-3 ${item.disabled ? "opacity-50 cursor-not-allowed text-gray-400" : "hover:bg-blue-50 hover:text-blue-700"} ${isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600"}`}
              >
                <Icon
                  size={18}
                  strokeWidth={2}
                  className={isActive ? "text-blue-600" : "text-gray-400"}
                />
                <span>
                  {item.disabled ? "Tracking (sin ruta)" : item.label}
                </span>
              </Link>
            );
          })}
      </nav>
   
      
    </aside>
  );
}
