import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  GitCompareArrows,
  Lightbulb,
  MapPinned,
  Sprout,
  LayoutDashboard,
  CheckCircle2,
  Satellite,
} from "lucide-react";
import { FeatureCard, SectionHeading, Button } from "../components/UI";

const features = [
  {
    icon: LayoutDashboard,
    title: "Field dashboard",
    description:
      "Review field condition indicators, crop history, climate context and NASA data quality information.",
    to: "/dashboard",
  },
  {
    icon: MapPinned,
    title: "Field management",
    description:
      "Register and manage fields with district, soil, drainage, irrigation and crop-history details.",
    to: "/fields",
  },
  {
    icon: Sprout,
    title: "Crop rotation planner",
    description:
      "Build crop sequences across seasons and adjust priorities to explore different rotation options.",
    to: "/planner",
  },
  {
    icon: GitCompareArrows,
    title: "Rotation comparison",
    description:
      "Compare candidate rotations, scores, potential benefits, trade-offs and field-level risks.",
    to: "/comparison",
  },
  {
    icon: Lightbulb,
    title: "Recommendations",
    description:
      "Review the suggested rotation alongside its supporting evidence and practical limitations.",
    to: "/recommendation",
  },
  {
    icon: CalendarDays,
    title: "Planting advisory",
    description:
      "Explore district- and crop-specific planting-window analysis, sensitivity details and SMS sharing.",
    to: "/advisory",
  },
];
const steps = [
  [
    "01",
    "Add your field",
    "Enter location, soil and water-management details, along with crop history.",
  ],
  [
    "02",
    "Explore options",
    "Choose crops, seasons and priorities, then compare possible crop sequences.",
  ],
  [
    "03",
    "Review the evidence",
    "Check the reasoning, risks, data provenance and limitations before making a decision.",
  ],
];
const HomePage = () => {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span /> CLIMATE-AWARE CROP ROTATION SUPPORT
          </div>
          <h1>
            Make more informed decisions for <em>every field.</em>
          </h1>
          <p>
            Field Shift brings field information and NASA Earth observation data
            together to help farmers explore crop-rotation options, understand
            climate context and review planting windows.
          </p>
          <div className="hero-actions">
            <Link className="button light" to="/dashboard">
              Open my dashboard <ArrowRight size={16} />
            </Link>
            <Link className="button outline-light" to="/planner">
              Explore rotation planner
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <CheckCircle2 size={15} /> Evidence-led insights
            </span>
            <span>
              <Satellite size={15} /> Earth observation context
            </span>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Illustration representing a mapped agricultural field"
        >
          <div className="field-map">
            <div className="field-lines" />
            <span className="map-pin" />
            <div className="map-chip chip-top">
              <small>EARTH OBSERVATION</small>
              <b>NASA data</b>
            </div>
            <div className="map-chip chip-bottom">
              <small>FIELD INTELLIGENCE</small>
              <b>One field at a time</b>
            </div>
          </div>
        </div>
        <div className="hero-decoration" />
      </section>
      <section className="content-section">
        <SectionHeading
          eyebrow="WHAT YOU CAN DO"
          title="Tools for better field decisions"
          description="Explore the main features available in Field Shift."
        />
        <div className="feature-grid">
          {features.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </section>
      <section className="content-section">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          title="From field details to a clearer choice"
          description="A guided workflow that keeps the farmer and the field at the centre."
        />
        <div className="steps-grid">
          {steps.map(([number, title, description]) => (
            <article className="step-card" key={number}>
              <span>{number} / STEP</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <aside className="disclaimer">
        <b>Important to know</b>
        <p>
          Field Shift is a decision-support tool, not a weather forecast or a
          guarantee of crop performance. Consider its results alongside local
          knowledge, field conditions and the uncertainty of Earth observation
          data.
        </p>
      </aside>
      <section className="home-cta">
        <div>
          <h2>Ready to explore your field?</h2>
          <p>Start with your field overview or create a field profile.</p>
        </div>
        <div>
          <Link className="button secondary" to="/fields">
            Manage fields
          </Link>
          <Link className="button primary" to="/dashboard">
            Go to dashboard <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
};
export default HomePage;
