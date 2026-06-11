import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Toaster } from "@/components/ui/sonner";
import Einstellungen from "@/pages/Einstellungen";
import Export from "@/pages/Export";
import Login from "@/pages/Login";
import Reisen from "@/pages/Reisen";
import Uebersicht from "@/pages/Uebersicht";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Navigate to="/uebersicht" replace /> },
      { path: "uebersicht", element: <Uebersicht /> },
      { path: "reisen", element: <Reisen /> },
      { path: "export", element: <Export /> },
      { path: "einstellungen", element: <Einstellungen /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
