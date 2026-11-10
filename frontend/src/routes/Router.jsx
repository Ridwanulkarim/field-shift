import { createBrowserRouter, Navigate } from "react-router";
import HomePage from "../pages/HomePage";
import DashboardPage from "../pages/DashboardPage";
import FieldsPage from "../pages/FieldsPage";
import PlannerPage from "../pages/PlannerPage";
import ComparisonPage from "../pages/ComparisonPage";
import RecommendationPage from "../pages/RecommendationPage";
import AdvisoryPage from "../pages/AdvisoryPage";
import MainLayout from "../layouts/MainLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "dashboard",
        Component: DashboardPage,
      },
      {
        path: "fields",
        Component: FieldsPage,
      },
      {
        path: "planner",
        Component: PlannerPage,
      },
      {
        path: "comparison",
        Component: ComparisonPage,
      },
      {
        path: "recommendation",
        Component: RecommendationPage,
      },
      {
        path: "advisory",
        Component: AdvisoryPage,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
