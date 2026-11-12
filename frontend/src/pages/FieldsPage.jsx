import { useCallback, useEffect, useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import useAxios from "../hooks/useAxios";
import { PageHeading, Card, Button, EmptyState } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";
import {
  MapContainer,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
  CircleMarker,
  Tooltip,
} from "react-leaflet";

const blank = {
  name: "",
  districtId: "",
  soilType: "Loamy",
  soilPh: "",
  organicMatterPct: "",
  salinityDsM: "",
  irrigationSource: "",
  boundary: null,
};

const copy = {
  en: {
    eyebrow: "YOUR FARM",
    title: "Field management",
    description: "Manage your fields and their soil and irrigation details.",
    addField: "Add field",
    registered: "Registered field",
    soil: "Soil type",
    irrigation: "Irrigation",
    edit: "Edit",
    delete: "Delete",
    emptyTitle: "No fields added yet",
    emptyDescription: "Create a field profile to get started.",
    firstField: "Add your first field",
    profile: "FIELD PROFILE",
    editTitle: "Edit field",
    addTitle: "Add a field",
    fieldName: "Field name",
    district: "District",
    soilPh: "Soil pH",
    organicMatter: "Organic matter (%)",
    salinity: "Salinity (dS/m)",
    irrigationSource: "Irrigation source",
    drawBoundary: "Click the map to add boundary points",
    points: "Points",
    cancel: "Cancel",
    save: "Save field",
    saving: "Saving…",
    loading: "Loading fields…",
    loadError: "Could not load fields.",
    retry: "Retry",
    selectDistrict: "Select a district",
    confirmDelete: "Are you sure you want to delete this field?",
    drawPolygon: "Add at least three boundary points on the map.",
    requestError:
      "Could not save the field. Please check your entries and try again.",
  },
  bn: {
    eyebrow: "আপনার খামার",
    title: "জমি ব্যবস্থাপনা",
    description: "জমি, মাটি ও সেচের তথ্য পরিচালনা করুন।",
    addField: "জমি যোগ করুন",
    registered: "নিবন্ধিত জমি",
    soil: "মাটির ধরন",
    irrigation: "সেচের উৎস",
    edit: "সম্পাদনা",
    delete: "মুছে ফেলুন",
    emptyTitle: "এখনো কোনো জমি যোগ করা হয়নি",
    emptyDescription: "শুরু করতে একটি জমির প্রোফাইল তৈরি করুন।",
    firstField: "প্রথম জমি যোগ করুন",
    profile: "জমির প্রোফাইল",
    editTitle: "জমি সম্পাদনা করুন",
    addTitle: "নতুন জমি যোগ করুন",
    fieldName: "জমির নাম",
    district: "জেলা",
    soilPh: "মাটির pH",
    organicMatter: "জৈব পদার্থ (%)",
    salinity: "লবণাক্ততা (dS/m)",
    irrigationSource: "সেচের উৎস",
    drawBoundary: "সীমানার পয়েন্ট যোগ করতে মানচিত্রে ক্লিক করুন",
    points: "পয়েন্ট",
    cancel: "বাতিল",
    save: "জমি সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে…",
    loading: "জমির তথ্য লোড হচ্ছে…",
    loadError: "জমির তথ্য লোড করা যায়নি।",
    retry: "আবার চেষ্টা করুন",
    selectDistrict: "জেলা নির্বাচন করুন",
    confirmDelete: "আপনি কি নিশ্চিত যে এই জমিটি মুছে ফেলতে চান?",
    drawPolygon: "মানচিত্রে অন্তত তিনটি সীমানার পয়েন্ট যোগ করুন।",
    requestError: "জমিটি সংরক্ষণ করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।",
  },
};

const soilOptions = ["Loamy", "Silty loam", "Clay", "Sandy"];

function BoundaryClickHandler({ positions, onChange }) {
  useMapEvents({
    click(event) {
      onChange([...positions, [event.latlng.lat, event.latlng.lng]]);
    },
  });

  return (
    <>
      {positions.length >= 3 && (
        <Polygon
          positions={positions}
          pathOptions={{
            color: "#16a34a",
            fillColor: "#22c55e",
            fillOpacity: 0.2,
            weight: 3,
          }}
        />
      )}

      {positions.map((position, index) => (
        <CircleMarker
          key={`${position[0]}-${position[1]}-${index}`}
          center={position}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#16a34a",
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            Point {index + 1}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

function DistrictMapFocus({ district }) {
  const map = useMap();

  useEffect(() => {
    if (!district) return;

    const lat = Number(district.latitude);
    const lng = Number(district.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    map.flyTo([lat, lng], 11, {
      animate: true,
      duration: 1.5,
    });
  }, [district, map]);

  return null;
}

function toMapPositions(boundary) {
  const ring = boundary?.coordinates?.[0];
  if (!Array.isArray(ring)) return [];

  // GeoJSON positions are [longitude, latitude]; Leaflet expects [latitude, longitude].
  const points = ring.map(([lng, lat]) => [lat, lng]);

  // Drop the duplicated closing coordinate while editing.
  if (
    points.length > 1 &&
    points[0][0] === points.at(-1)[0] &&
    points[0][1] === points.at(-1)[1]
  ) {
    points.pop();
  }

  return points;
}

function toGeoJsonPolygon(positions) {
  const ring = positions.map(([lat, lng]) => [lng, lat]);

  if (ring.length > 0) {
    ring.push([...ring[0]]);
  }

  return {
    type: "Polygon",
    coordinates: [ring],
  };
}

export default function FieldsPage() {
  const axios = useAxios();
  const { language } = useLanguage();
  const t = copy[language] || copy.en;

  const [fields, setFields] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState(blank);
  const [boundaryPoints, setBoundaryPoints] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const selectedDistrict = districts.find(
    (district) => Number(district.id) === Number(form.districtId),
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [fieldsResponse, districtsResponse] = await Promise.all([
        axios.get("/fields"),
        axios.get("/districts"),
      ]);

      const loadedFields = fieldsResponse.data.fields ?? [];

      setFields(loadedFields);
      setDistricts(districtsResponse.data.districts ?? []);
    } catch (err) {
      console.error("LOAD FIELDS ERROR:", err.response?.data);
      setError(err.response?.data?.error?.message || t.loadError);
    } finally {
      setLoading(false);
    }
  }, [axios, t.loadError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm(blank);
    setBoundaryPoints([]);
    setEditingId(null);
    setFormError("");
    setIsOpen(false);
  };

  const startEdit = async (field) => {
    setFormError("");

    try {
      // Fetch the field detail because the list response may not include its boundary.
      const response = await axios.get(`/fields/${field.id}`);
      const fullField = response.data.field ?? response.data;

      setEditingId(field.id);
      setForm({
        name: fullField.name ?? "",
        districtId: String(fullField.districtId ?? ""),
        soilType: fullField.soilType ?? "Loamy",
        soilPh: fullField.soilPh ?? "",
        organicMatterPct: fullField.organicMatterPct ?? "",
        salinityDsM: fullField.salinityDsM ?? "",
        irrigationSource: fullField.irrigationSource ?? "",
        boundary: fullField.boundary ?? null,
      });
      setBoundaryPoints(toMapPositions(fullField.boundary));
      setIsOpen(true);
    } catch (err) {
      setFormError(err.response?.data?.error?.message || t.requestError);
    }
  };

  const saveField = async (event) => {
    event.preventDefault();
    setFormError("");

    if (boundaryPoints.length < 3) {
      setFormError(t.drawPolygon);
      return;
    }

    const payload = {
      name: form.name.trim(),
      districtId: Number(form.districtId),
      boundary: toGeoJsonPolygon(boundaryPoints),
      soilType: form.soilType,
      irrigationSource: form.irrigationSource.trim(),
    };

    // Send optional numeric properties only when the user filled them in.
    for (const key of ["soilPh", "organicMatterPct", "salinityDsM"]) {
      if (form[key] !== "" && form[key] !== null) {
        payload[key] = Number(form[key]);
      }
    }

    setSaving(true);

    try {
      if (editingId) {
        await axios.patch(`/fields/${editingId}`, payload);
      } else {
        await axios.post("/fields", payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      const details = err.response?.data?.error?.details;
      const detailMessage = Array.isArray(details)
        ? details
            .map((item) => item.message)
            .filter(Boolean)
            .join(" ")
        : "";

      setFormError(
        detailMessage || err.response?.data?.error?.message || t.requestError,
      );
    } finally {
      setSaving(false);
    }
  };

  const removeField = async (id) => {
    if (!window.confirm(t.confirmDelete)) return;

    setError("");

    try {
      await axios.delete(`/fields/${id}`);
      setFields((current) => current.filter((field) => field.id !== id));
    } catch (err) {
      setError(err.response?.data?.error?.message || t.requestError);
    }
  };

  const getDistrictName = (field) => {
    const district = districts.find(
      (item) => Number(item.id) === Number(field.districtId),
    );

    if (!district) return field.districtId;

    return language === "bn"
      ? district.nameBn || district.nameEn || district.name
      : district.nameEn || district.name;
  };

  const openNewField = () => {
    setForm(blank);
    setBoundaryPoints([]);
    setEditingId(null);
    setFormError("");
    setIsOpen(true);
  };

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        action={
          <Button onClick={openNewField}>
            <Plus size={16} />
            {t.addField}
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          <button className="mt-2 underline" onClick={loadData}>
            {t.retry}
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-slate-600">{t.loading}</p>
      ) : fields.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={<Button onClick={openNewField}>{t.firstField}</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map((field) => (
            <Card className="p-5" key={field.id}>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-green-50 p-2 text-green-700">
                  <MapPin size={18} />
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {t.registered}
                </span>
              </div>

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {field.name}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {getDistrictName(field)}
                {field.areaHa != null && (
                  <> · {Number(field.areaHa).toFixed(2)} ha</>
                )}
              </p>

              <div className="mt-4 space-y-2 text-sm">
                <p className="flex justify-between gap-3">
                  <span className="text-slate-500">{t.soil}</span>
                  <span className="font-medium">{field.soilType || "—"}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-slate-500">{t.irrigation}</span>
                  <span className="font-medium">
                    {field.irrigationSource || "—"}
                  </span>
                </p>
              </div>

              <div className="mt-5 flex gap-4 border-t pt-4">
                <button
                  className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-green-700"
                  onClick={() => startEdit(field)}
                >
                  <Pencil size={14} />
                  {t.edit}
                </button>
                <button
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                  onClick={() => removeField(field.id)}
                >
                  <Trash2 size={14} />
                  {t.delete}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resetForm();
          }}
        >
          <form
            className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={saveField}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wider text-green-700">
                  {t.profile}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  {editingId ? t.editTitle : t.addTitle}
                </h2>
              </div>
              <button
                type="button"
                className="rounded p-1 text-2xl leading-none text-slate-500 hover:bg-slate-100"
                onClick={resetForm}
                aria-label={t.cancel}
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                {t.fieldName}
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                {t.district}
                <select
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.districtId}
                  onChange={(event) =>
                    setForm({ ...form, districtId: event.target.value })
                  }
                >
                  <option value="">{t.selectDistrict}</option>

                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {language === "bn"
                        ? district.nameBn || district.nameEn || district.name
                        : district.nameEn || district.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                {t.soil}
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.soilType}
                  onChange={(event) =>
                    setForm({ ...form, soilType: event.target.value })
                  }
                >
                  {soilOptions.map((soil) => (
                    <option key={soil} value={soil}>
                      {soil}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                {t.irrigationSource}
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.irrigationSource}
                  onChange={(event) =>
                    setForm({ ...form, irrigationSource: event.target.value })
                  }
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                {t.soilPh}
                <input
                  type="number"
                  step="any"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.soilPh}
                  onChange={(event) =>
                    setForm({ ...form, soilPh: event.target.value })
                  }
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                {t.organicMatter}
                <input
                  type="number"
                  step="any"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.organicMatterPct}
                  onChange={(event) =>
                    setForm({ ...form, organicMatterPct: event.target.value })
                  }
                />
              </label>

              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                {t.salinity}
                <input
                  type="number"
                  step="any"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 sm:max-w-xs"
                  value={form.salinityDsM}
                  onChange={(event) =>
                    setForm({ ...form, salinityDsM: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-700">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    {t.drawBoundary}
                  </p>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {boundaryPoints.length} / 3+
                  </span>
                </div>
              </p>
              <MapContainer
                center={[24.0, 90.0]}
                zoom={7}
                className="h-72 w-full rounded-lg"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Focus on selected district */}
                <DistrictMapFocus district={selectedDistrict} />

                {/* Draw field boundary */}
                <BoundaryClickHandler
                  positions={boundaryPoints}
                  onChange={setBoundaryPoints}
                />
              </MapContainer>

              {boundaryPoints.length > 0 && (
                <button
                  type="button"
                  className="mt-2 text-sm text-red-600 underline"
                  onClick={() => setBoundaryPoints([])}
                >
                  Clear boundary
                </button>
              )}
            </div>

            {formError && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={resetForm}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t.saving : t.save}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
