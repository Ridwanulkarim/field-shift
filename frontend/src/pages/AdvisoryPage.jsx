import { useState } from "react";
import { Copy, CalendarDays, Info } from "lucide-react";
import { PageHeading, Card, SectionHeading, Button } from "../components/UI";
const districts = ["Rajshahi", "Dinajpur", "Mymensingh", "Jessore", "Satkhira"];
const crops = ["Aman Rice", "Aus Rice", "Boro Rice", "Wheat", "Chickpea"];

const AdvisoryPage = () => {
  const [district, setDistrict] = useState("Rajshahi");
  const [crop, setCrop] = useState("Aman Rice");
  const [sms, setSms] = useState(
    "Field Shift: Review the planting window for Aman Rice in Rajshahi. Check local field conditions and updated guidance before planting.",
  );
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sms);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="SEASONAL CONTEXT"
        title="Planting window advisory"
        description="Explore planting-window analysis by district and crop, including sensitivity and method details."
      />
      <div className="advisory-layout">
        <Card>
          <SectionHeading
            title="Select your location and crop"
            description="Choose a district and crop to inspect the advisory context."
          />
          <div className="form-grid">
            <label>
              District
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {districts.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Crop
              <select value={crop} onChange={(e) => setCrop(e.target.value)}>
                {crops.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <Button
            className="advisory-submit"
            onClick={() =>
              setSms(
                `Field Shift: Review the planting window for ${crop} in ${district}. Check local field conditions and updated guidance before planting.`,
              )
            }
          >
            Update advisory preview
          </Button>
          <div className="window-result">
            <div className="window-icon">
              <CalendarDays />
            </div>
            <div>
              <small>PLANTING WINDOW PREVIEW</small>
              <h3>
                {crop} · {district}
              </h3>
              <p>
                Review the locally relevant planting window and its uncertainty
                before making a decision.
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <SectionHeading
            title="SMS-ready summary"
            description="Keep the message concise for sharing."
          />
          <textarea
            className="sms-box"
            maxLength={160}
            value={sms}
            onChange={(e) => setSms(e.target.value)}
          />
          <div className="sms-footer">
            <span>{sms.length}/160 characters</span>
            <Button variant="secondary" onClick={copy}>
              <Copy size={15} />
              {copied ? "Copied" : "Copy SMS"}
            </Button>
          </div>
        </Card>
      </div>
      <Card className="method-card">
        <SectionHeading
          title="Method and sensitivity"
          description="Interpret the advisory with its assumptions visible."
        />
        <div className="info-banner">
          <Info size={18} />
          <p>
            Planting-window outputs are analytical guidance, not a guarantee of
            weather conditions or crop outcomes. Sensitivity to input data and
            method assumptions should be reviewed.
          </p>
        </div>
        <div className="audit-items">
          <span>District and crop selection</span>
          <span>Input data coverage</span>
          <span>Method assumptions</span>
          <span>Uncertainty disclosure</span>
        </div>
      </Card>
    </>
  );
};
export default AdvisoryPage;
