import { createBrowserRouter, Navigate } from "react-router";
import MainLayout from "../layouts/MainLayout";
import FieldSetup from "../pages/FieldSetup";
import RotationPlanner from "../pages/RotationPlanner";
import RotationComparison from "../pages/RotationComparison";
import Recommendation from "../pages/Recommendation";
import PlantingWindowAdvisory from "../components/PlantingWindowAdvisory";
import Dashboard from "../pages/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,

    children: [
      {
        index: true,
        Component: Dashboard,
      },
      {
        path: "advisory",
        Component: PlantingWindowAdvisory,
      },
      {
        path: "planner",
        Component: RotationPlanner,
      },
      {
        path: "comparison",
        Component: RotationComparison,
      },
      {
        path: "recommendation",
        Component: Recommendation,
      },
      {
        path: "fields",
        Component: FieldSetup,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
