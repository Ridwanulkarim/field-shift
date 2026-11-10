import { useState } from "react";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import { fields as initialFields } from "../data/mockData";
import { PageHeading, Card, Button, EmptyState } from "../components/UI";

const blank = {
  name: "",
  district: "",
  area: "",
  soil: "Loamy",
  drainage: "Moderate",
  irrigation: "Available",
  crop: "",
};
const FieldsPage = () => {
  const [fields, setFields] = useState(initialFields);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const save = (e) => {
    e.preventDefault();
    if (editing)
      setFields((old) =>
        old.map((f) => (f.id === editing ? { ...form, id: editing } : f)),
      );
    else setFields((old) => [...old, { ...form, id: Date.now() }]);
    setOpen(false);
    setEditing(null);
    setForm(blank);
  };
  const edit = (field) => {
    setEditing(field.id);
    setForm({ ...field });
    setOpen(true);
  };
  const remove = (id) => setFields((old) => old.filter((f) => f.id !== id));
  return (
    <>
      <PageHeading
        eyebrow="YOUR FARM"
        title="Field management"
        description="Keep field location, soil, water management and crop-history details organised."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(blank);
              setOpen(true);
            }}
          >
            <Plus size={16} /> Add field
          </Button>
        }
      />
      <div className="field-grid">
        {fields.map((field) => (
          <Card className="field-card" key={field.id}>
            <div className="field-card-top">
              <span className="field-icon">
                <MapPin size={18} />
              </span>
              <span className="pill">Registered field</span>
            </div>
            <h3>{field.name}</h3>
            <p className="muted">
              {field.district} · {field.area}
            </p>
            <div className="field-details">
              <span>
                Soil type <b>{field.soil}</b>
              </span>
              <span>
                Drainage <b>{field.drainage}</b>
              </span>
              <span>
                Irrigation <b>{field.irrigation}</b>
              </span>
              <span>
                Recent crop <b>{field.crop}</b>
              </span>
            </div>
            <div className="card-actions">
              <button className="text-button" onClick={() => edit(field)}>
                <Pencil size={14} /> Edit
              </button>
              <button
                className="text-button danger"
                onClick={() => remove(field.id)}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
      {!fields.length && (
        <EmptyState
          title="No fields added yet"
          description="Create a field profile to start exploring crop rotations."
          action={
            <Button onClick={() => setOpen(true)}>Add your first field</Button>
          }
        />
      )}
      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form className="modal" onSubmit={save}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">FIELD PROFILE</div>
                <h2>{editing ? "Edit field" : "Add a field"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <label>
              Field name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. North Plot"
              />
            </label>
            <label>
              District
              <input
                required
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                placeholder="District"
              />
            </label>
            <label>
              Area
              <input
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="e.g. 2 acres"
              />
            </label>
            <label>
              Soil type
              <select
                value={form.soil}
                onChange={(e) => setForm({ ...form, soil: e.target.value })}
              >
                <option>Loamy</option>
                <option>Silty loam</option>
                <option>Clay</option>
                <option>Sandy</option>
              </select>
            </label>
            <label>
              Drainage
              <select
                value={form.drainage}
                onChange={(e) => setForm({ ...form, drainage: e.target.value })}
              >
                <option>Good</option>
                <option>Moderate</option>
                <option>Poor</option>
              </select>
            </label>
            <label>
              Irrigation
              <select
                value={form.irrigation}
                onChange={(e) =>
                  setForm({ ...form, irrigation: e.target.value })
                }
              >
                <option>Available</option>
                <option>Limited</option>
                <option>Unavailable</option>
              </select>
            </label>
            <label>
              Recent crop
              <input
                value={form.crop}
                onChange={(e) => setForm({ ...form, crop: e.target.value })}
                placeholder="Crop history"
              />
            </label>
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save field</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FieldsPage;
