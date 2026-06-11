import { UnauthorizedError, api } from "@/lib/api";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { NavTabs } from "./NavTabs";
import { TopBar } from "./TopBar";

export function ProtectedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .getHealth()
      .then(() => setReady(true))
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          navigate("/login", { replace: true });
        } else {
          // Network-Fehler oder unbekannt: trotzdem rendern, Pages zeigen eigene Errors
          setReady(true);
        }
      });
  }, [navigate]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center">…</div>;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <NavTabs />
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
