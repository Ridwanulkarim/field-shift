import { Link } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Info,
  AlertTriangle,
  Satellite,
} from "lucide-react";
import { PageHeading, Card, SectionHeading } from "../components/UI";

const RecommendationPage = () => {
  return (
    <>
      <PageHeading
        eyebrow="DECISION SUPPORT"
        title="Rotation recommendation"
        description="Review the leading option, why it may fit and what still needs local verification."
      />
      <Card className="recommendation-hero">
        <div className="recommendation-badge">
          <CheckCircle2 size={16} /> TOP ILLUSTRATIVE OPTION
        </div>
        <h2>Aman Rice → Lentil → Mung bean</h2>
        <p>
          A candidate sequence to review against field conditions, local
          agronomic guidance and the assumptions used in the evaluation.
        </p>
        <div className="recommendation-score">
          <b>87</b>
          <span>
            / 100
            <br />
            Illustrative score
          </span>
        </div>
      </Card>
      <div className="recommendation-grid">
        <Card>
          <SectionHeading title="Why this option is surfaced" />
          <ul className="reason-list">
            <li>
              <CheckCircle2 />
              Potential to diversify seasonal crop sequences.
            </li>
            <li>
              <CheckCircle2 />
              Can be assessed against soil-health priorities.
            </li>
            <li>
              <CheckCircle2 />
              Allows comparison of water requirements across seasons.
            </li>
          </ul>
        </Card>
        <Card>
          <SectionHeading title="Trade-offs to consider" />
          <ul className="reason-list caution">
            <li>
              <AlertTriangle />
              Actual suitability depends on local planting windows.
            </li>
            <li>
              <AlertTriangle />
              Water access and drainage can change the outcome.
            </li>
            <li>
              <AlertTriangle />
              Market access, seed availability and labour are not guaranteed.
            </li>
          </ul>
        </Card>
      </div>
      <Card className="evidence-card">
        <SectionHeading
          title="Evidence and limitations"
          description="A recommendation should remain explainable and traceable."
        />
        <div className="audit-items">
          <span>
            <Satellite /> Earth observation context
          </span>
          <span>
            <Info /> Evaluation assumptions
          </span>
          <span>
            <AlertTriangle /> Uncertainty and limitations
          </span>
        </div>
        <p className="muted">
          Replace these illustrative explanations with the evidence and
          limitations returned by the existing backend.
        </p>
      </Card>
      <div className="bottom-action">
        <p>Review planting-window context for a district and crop.</p>
        <Link className="button primary" to="/advisory">
          Open planting advisory <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
};

export default RecommendationPage;
