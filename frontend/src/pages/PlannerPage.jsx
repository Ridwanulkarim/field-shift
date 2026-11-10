import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
const cropOptions = [
  "Aman Rice",
  "Aus Rice",
  "Boro Rice",
  "Wheat",
  "Lentil",
  "Mustard",
  "Mung bean",
  "Chickpea",
];
const PlannerPage = () => {
  const [seasons, setSeasons] = useState(["Aman Rice", "Lentil", "Mung bean"]);
  const [priorities, setPriorities] = useState({
    water: 60,
    soil: 80,
    risk: 65,
  });
  const update = (i, value) =>
    setSeasons((old) => old.map((crop, index) => (index === i ? value : crop)));
  return (
    <>
      <PageHeading
        eyebrow="PLANNING WORKSPACE"
        title="Crop rotation planner"
        description="Build a seasonal crop sequence and tune the factors that matter to your field."
      />
      <div className="planner-layout">
        <Card>
          <SectionHeading
            title="Rotation sequence"
            description="Choose a crop for each season in your proposed sequence."
          />
          <div className="season-list">
            {seasons.map((crop, i) => (
              <div className="season-row" key={i}>
                <span className="season-number">0{i + 1}</span>
                <div>
                  <small>SEASON {i + 1}</small>
                  <select
                    value={crop}
                    onChange={(e) => update(i, e.target.value)}
                  >
                    {cropOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div className="inline-actions">
            <Button
              variant="secondary"
              onClick={() =>
                setSeasons((old) => (old.length < 4 ? [...old, "Wheat"] : old))
              }
              disabled={seasons.length >= 4}
            >
              Add season
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSeasons(["Aman Rice", "Lentil", "Mung bean"])}
            >
              <RotateCcw size={15} /> Reset
            </Button>
          </div>
        </Card>
        <Card>
          <SectionHeading
            title="Planning priorities"
            description="Adjust the relative importance of each consideration."
          />
          <div className="range-list">
            {Object.entries(priorities).map(([key, value]) => (
              <label className="range-item" key={key}>
                <span>
                  <b>
                    {key === "water"
                      ? "Water efficiency"
                      : key === "soil"
                        ? "Soil health"
                        : "Risk tolerance"}
                  </b>
                  <strong>{value}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(e) =>
                    setPriorities({
                      ...priorities,
                      [key]: Number(e.target.value),
                    })
                  }
                />
                <small>Set the importance for this planning scenario.</small>
              </label>
            ))}
          </div>
          <Link className="button primary full-button" to="/comparison">
            Compare rotation options <ArrowRight size={16} />
          </Link>
        </Card>
      </div>
      <p className="helper-note">
        Prototype note: this screen demonstrates the planner controls. Connect
        the form state to your existing rotation-evaluation API to calculate
        real candidate scores.
      </p>
    </>
  );
};
export default PlannerPage;
