import {
  Activity,
  CloudRain,
  MapPinned,
  Satellite,
  TrendingUp,
} from "lucide-react";
import { PageHeading, StatCard, Card, SectionHeading } from "../components/UI";

const DashboardPage = () => {
  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title="Field dashboard"
        description="A consolidated view of your field context, crop history and available environmental data."
      />
      <div className="stats-grid">
        <StatCard
          label="Field condition score"
          value="78 / 100"
          detail="Illustrative heuristic score"
          icon={Activity}
        />
        <StatCard
          label="Registered fields"
          value="02"
          detail="Across 2 districts"
          icon={MapPinned}
          tone="blue"
        />
        <StatCard
          label="Climate context"
          value="Available"
          detail="Observation coverage varies"
          icon={CloudRain}
          tone="amber"
        />
        <StatCard
          label="Data provenance"
          value="Auditable"
          detail="Source and quality details"
          icon={Satellite}
        />
      </div>
      <div className="dashboard-grid">
        <Card>
          <SectionHeading
            title="Field location"
            description="Illustrative field overview in Bangladesh."
          />
          <div className="map-placeholder">
            <div className="map-river" />
            <span className="map-marker marker-a">North Plot</span>
            <span className="map-marker marker-b">River-side Field</span>
            <span className="map-label">BANGLADESH</span>
          </div>
        </Card>
        <Card>
          <SectionHeading
            title="Environmental context"
            description="Example indicators, not a forecast."
          />
          <div className="metric-list">
            {[
              ["Rainfall context", "Moderate", "68%"],
              ["Soil moisture context", "Stable", "74%"],
              ["Vegetation signal", "Healthy", "82%"],
            ].map(([name, status, val]) => (
              <div className="metric-row" key={name}>
                <div>
                  <b>{name}</b>
                  <small>{status}</small>
                </div>
                <strong>{val}</strong>
                <div className="progress">
                  <i style={{ width: val }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="audit-card">
        <SectionHeading
          title="NASA data quality & provenance"
          description="Review source, temporal coverage and limitations before interpreting derived indicators."
        />
        <div className="audit-items">
          <span>
            <Satellite size={17} /> Earth observation sources
          </span>
          <span>
            <Activity size={17} /> Quality checks
          </span>
          <span>
            <TrendingUp size={17} /> Derived indicators
          </span>
        </div>
        <p className="muted">
          Connect this panel to the API response and metadata returned by your
          existing backend before production use.
        </p>
      </Card>
    </>
  );
};

export default DashboardPage;
