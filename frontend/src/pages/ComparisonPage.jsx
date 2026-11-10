import { Link } from "react-router";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { rotations } from "../data/mockData";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
const ComparisonPage = () => {
  return (
    <>
      <PageHeading
        eyebrow="EVALUATE OPTIONS"
        title="Rotation comparison"
        description="Compare candidate crop sequences using their relative scores, benefits and risks."
        action={
          <Link className="button secondary" to="/planner">
            Edit plan
          </Link>
        }
      />
      <Card>
        <SectionHeading
          title="Candidate rotations"
          description="Illustrative results for interface preview only."
        />
        <div className="comparison-grid">
          {rotations.map((item, i) => (
            <article
              className={`rotation-card ${i === 0 ? "recommended" : ""}`}
              key={item.name}
            >
              <div className="rotation-top">
                <span className="pill">
                  {i === 0 ? "Top illustrative score" : "Alternative"}
                </span>
                <span className="score">
                  {item.score}
                  <small>/100</small>
                </span>
              </div>
              <h3>{item.name}</h3>
              <p>{item.note}</p>
              <div className="progress">
                <i style={{ width: `${item.score}%` }} />
              </div>
              <div className="risk-row">
                <span>Risk profile</span>
                <b>{item.risk}</b>
              </div>
              <div className="rotation-insight">
                {i === 0 ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <span>
                  {i === 0
                    ? "Review this option against local conditions."
                    : "Review the trade-offs before selecting."}
                </span>
              </div>
            </article>
          ))}
        </div>
      </Card>
      <div className="bottom-action">
        <p>
          Want to review the evidence and limitations behind the leading option?
        </p>
        <Link className="button primary" to="/recommendation">
          View recommendation <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
};

export default ComparisonPage;
