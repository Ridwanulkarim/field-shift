
import { useState } from "react";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";

import { fields as initialFields } from "../data/mockData";

import {
  PageHeading,
  Card,
  Button,
  EmptyState,
} from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";


const blank = {
  name: "",
  district: "",
  area: "",
  soil: "Loamy",
  drainage: "Moderate",
  irrigation: "Available",
  crop: "",
};

const translations = {
  en: {
    eyebrow: "YOUR FARM",
    title: "Field management",
    description:
      "Keep field location, soil, water management and crop-history details organised.",

    addField: "Add field",
    registered: "Registered field",

    soil: "Soil type",
    drainage: "Drainage",
    irrigation: "Irrigation",
    recentCrop: "Recent crop",

    edit: "Edit",
    delete: "Delete",

    emptyTitle: "No fields added yet",
    emptyDescription:
      "Create a field profile to start exploring crop rotations.",
    firstField: "Add your first field",

    profile: "FIELD PROFILE",
    editTitle: "Edit field",
    addTitle: "Add a field",

    fieldName: "Field name",
    district: "District",
    area: "Area",

    soilOptions: {
      Loamy: "Loamy",
      "Silty loam": "Silty loam",
      Clay: "Clay",
      Sandy: "Sandy",
    },

    drainageOptions: {
      Good: "Good",
      Moderate: "Moderate",
      Poor: "Poor",
    },

    irrigationOptions: {
      Available: "Available",
      Limited: "Limited",
      Unavailable: "Unavailable",
    },

    cropPlaceholder: "Crop history",
    namePlaceholder: "e.g. North Plot",
    districtPlaceholder: "District",
    areaPlaceholder: "e.g. 2 acres",

    cancel: "Cancel",
    save: "Save field",

    confirmDelete: "Are you sure you want to delete this field?",
  },

  bn: {
    eyebrow: "আপনার খামার",
    title: "জমি ব্যবস্থাপনা",
    description:
      "জমির অবস্থান, মাটি, পানি ব্যবস্থাপনা এবং ফসলের ইতিহাসের তথ্য সুশৃঙ্খলভাবে সংরক্ষণ করুন।",

    addField: "জমি যোগ করুন",
    registered: "নিবন্ধিত জমি",

    soil: "মাটির ধরন",
    drainage: "পানি নিষ্কাশন",
    irrigation: "সেচ ব্যবস্থা",
    recentCrop: "সাম্প্রতিক ফসল",

    edit: "সম্পাদনা",
    delete: "মুছে ফেলুন",

    emptyTitle: "এখনো কোনো জমি যোগ করা হয়নি",
    emptyDescription:
      "শস্য পর্যায় অনুসন্ধান শুরু করতে একটি জমির প্রোফাইল তৈরি করুন।",
    firstField: "প্রথম জমি যোগ করুন",

    profile: "জমির প্রোফাইল",
    editTitle: "জমি সম্পাদনা করুন",
    addTitle: "নতুন জমি যোগ করুন",

    fieldName: "জমির নাম",
    district: "জেলা",
    area: "জমির পরিমাণ",

    soilOptions: {
      Loamy: "দোআঁশ",
      "Silty loam": "পলিমিশ্রিত দোআঁশ",
      Clay: "এঁটেল মাটি",
      Sandy: "বেলে মাটি",
    },

    drainageOptions: {
      Good: "ভালো",
      Moderate: "মাঝারি",
      Poor: "খারাপ",
    },

    irrigationOptions: {
      Available: "উপলব্ধ",
      Limited: "সীমিত",
      Unavailable: "অনুপলব্ধ",
    },

    cropPlaceholder: "ফসলের ইতিহাস",
    namePlaceholder: "যেমন: উত্তর প্লট",
    districtPlaceholder: "জেলার নাম",
    areaPlaceholder: "যেমন: ২ একর",

    cancel: "বাতিল",
    save: "জমি সংরক্ষণ করুন",

    confirmDelete: "আপনি কি নিশ্চিত যে এই জমিটি মুছে ফেলতে চান?",
  },
};

const districtTranslations = {
  Rajshahi: "রাজশাহী",
  Dinajpur: "দিনাজপুর",
  Mymensingh: "ময়মনসিংহ",
  Jessore: "যশোর",
  Satkhira: "সাতক্ষীরা",
};

const cropTranslations = {
  "Aman Rice": "আমন ধান",
  "Aus Rice": "আউশ ধান",
  "Boro Rice": "বোরো ধান",
  Wheat: "গম",
  Lentil: "মসুর ডাল",
  Mustard: "সরিষা",
  "Mung bean": "মুগ ডাল",
  Chickpea: "ছোলা",
};

const FieldsPage = () => {
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [fields, setFields] = useState(initialFields);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const translate = (value, dictionary = {}) =>
    language === "bn" ? dictionary[value] || value : value;

  const getFieldName = (field) =>
    language === "bn" ? field.nameBn || field.name : field.name;

  const getDistrict = (field) =>
    language === "bn"
      ? field.districtBn || districtTranslations[field.district] || field.district
      : field.district;

  const getArea = (field) =>
    language === "bn" ? field.areaBn || field.area : field.area;

  const getSoil = (field) =>
    language === "bn"
      ? field.soilBn || t.soilOptions[field.soil] || field.soil
      : field.soil;

  const getDrainage = (field) =>
    language === "bn"
      ? field.drainageBn || t.drainageOptions[field.drainage] || field.drainage
      : field.drainage;

  const getIrrigation = (field) =>
    language === "bn"
      ? field.irrigationBn ||
        t.irrigationOptions[field.irrigation] ||
        field.irrigation
      : field.irrigation;

  const getCrop = (field) =>
    language === "bn"
      ? field.cropBn || cropTranslations[field.crop] || field.crop
      : field.crop;

  const save = (e) => {
    e.preventDefault();

    if (editing) {
      setFields((old) =>
        old.map((f) =>
          f.id === editing ? { ...form, id: editing } : f
        )
      );
    } else {
      setFields((old) => [
        ...old,
        { ...form, id: Date.now() },
      ]);
    }

    setOpen(false);
    setEditing(null);
    setForm(blank);
  };

  const edit = (field) => {
    setEditing(field.id);
    setForm({ ...field });
    setOpen(true);
  };

  const remove = (id) => {
    if (!window.confirm(t.confirmDelete)) return;

    setFields((old) => old.filter((f) => f.id !== id));
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(blank);
  };

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(blank);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            {t.addField}
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

              <span className="pill">
                {t.registered}
              </span>
            </div>

            <h3>{getFieldName(field)}</h3>

            <p className="muted">
              {getDistrict(field)} · {getArea(field)}
            </p>

            <div className="field-details">
              <span>
                {t.soil}
                <b>{getSoil(field)}</b>
              </span>

              <span>
                {t.drainage}
                <b>{getDrainage(field)}</b>
              </span>

              <span>
                {t.irrigation}
                <b>{getIrrigation(field)}</b>
              </span>

              <span>
                {t.recentCrop}
                <b>{getCrop(field)}</b>
              </span>
            </div>

            <div className="card-actions">
              <button
                className="text-button"
                onClick={() => edit(field)}
              >
                <Pencil size={14} />
                {t.edit}
              </button>

              <button
                className="text-button danger"
                onClick={() => remove(field.id)}
              >
                <Trash2 size={14} />
                {t.delete}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {!fields.length && (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={
            <Button onClick={() => setOpen(true)}>
              {t.firstField}
            </Button>
          }
        />
      )}

      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) =>
            e.target === e.currentTarget && closeModal()
          }
        >
          <form className="modal" onSubmit={save}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">
                  {t.profile}
                </div>

                <h2>
                  {editing ? t.editTitle : t.addTitle}
                </h2>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeModal}
                aria-label={t.cancel}
              >
                ×
              </button>
            </div>

            <label>
              {t.fieldName}

              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder={t.namePlaceholder}
              />
            </label>

            <label>
              {t.district}

              <input
                required
                value={form.district}
                onChange={(e) =>
                  setForm({ ...form, district: e.target.value })
                }
                placeholder={t.districtPlaceholder}
              />
            </label>

            <label>
              {t.area}

              <input
                value={form.area}
                onChange={(e) =>
                  setForm({ ...form, area: e.target.value })
                }
                placeholder={t.areaPlaceholder}
              />
            </label>

            <label>
              {t.soil}

              <select
                value={form.soil}
                onChange={(e) =>
                  setForm({ ...form, soil: e.target.value })
                }
              >
                {Object.entries(t.soilOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t.drainage}

              <select
                value={form.drainage}
                onChange={(e) =>
                  setForm({ ...form, drainage: e.target.value })
                }
              >
                {Object.entries(t.drainageOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t.irrigation}

              <select
                value={form.irrigation}
                onChange={(e) =>
                  setForm({
                    ...form,
                    irrigation: e.target.value,
                  })
                }
              >
                {Object.entries(t.irrigationOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t.recentCrop}

              <input
                value={form.crop}
                onChange={(e) =>
                  setForm({ ...form, crop: e.target.value })
                }
                placeholder={t.cropPlaceholder}
              />
            </label>

            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModal}
              >
                {t.cancel}
              </Button>

              <Button type="submit">
                {t.save}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FieldsPage;
