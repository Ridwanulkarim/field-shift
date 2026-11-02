import React, { useState, useEffect } from "react";
import { Outlet } from "react-router";

import Navbar from "../components/shared/Navbar";
import Footer from "../components/shared/Footer";
import BackgroundCanvas from "../components/shared/BackgroundCanvas";

import { fetchFields, fetchField, fetchHealth } from "../services/api";

import { INITIAL_FIELDS, INITIAL_HISTORY } from "../data/initialData.js";

const MainLayout = () => {
  const [fields, setFields] = useState(INITIAL_FIELDS);

  const [selectedFieldId, setSelectedFieldId] = useState(
    INITIAL_FIELDS[0]?.id ?? null,
  );

  const [selectedField, setSelectedField] = useState(INITIAL_FIELDS[0] ?? null);

  const [cropHistory, setCropHistory] = useState(INITIAL_HISTORY);

  const [health, setHealth] = useState({
    status: "ok",
    version: "v6.2",
  });

  const [language, setlanguage] = useState(() => {
    return localStorage.getItem("fieldshift_language") || "bn";
  });

  const [isBlurMode, setIsBlurMode] = useState(() => {
    return localStorage.getItem("fieldshift_blur_mode") === "true";
  });

  const [isLoadingFields, setIsLoadingFields] = useState(false);

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [error, setError] = useState(null);

  // ==========================================
  // PERSIST USER PREFERENCES
  // ==========================================

  useEffect(() => {
    localStorage.setItem("fieldshift_language", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("fieldshift_blur_mode", isBlurMode);
  }, [isBlurMode]);

  // ==========================================
  // INITIAL BACKGROUND DATA FETCHING
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    async function initializeApp() {
      setIsLoadingFields(true);
      setError(null);

      try {
        const [healthData, fieldsData] = await Promise.all([
          fetchHealth().catch((err) => ({
            status: "ok",
            version: "v6.2",
            message: err.message,
          })),

          fetchFields().catch((err) => {
            console.warn("Fields API unavailable:", err);

            return {
              fields: INITIAL_FIELDS,
            };
          }),
        ]);

        if (cancelled) return;

        // Update health status
        if (healthData) {
          setHealth(healthData);
        }

        // Update fields
        if (fieldsData?.fields?.length > 0) {
          setFields(fieldsData.fields);

          setSelectedFieldId((prev) => {
            const existingField = fieldsData.fields.find(
              (field) => field.id === prev,
            );

            return existingField?.id ?? fieldsData.fields[0].id;
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Application initialization failed:", err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFields(false);
        }
      }
    }

    initializeApp();

    return () => {
      cancelled = true;
    };
  }, []);

  // ==========================================
  // SELECTED FIELD SYNCHRONIZATION
  // ==========================================

  useEffect(() => {
    if (selectedFieldId == null || fields.length === 0) return;

    const field =
      fields.find((item) => item.id === selectedFieldId) || fields[0];

    setSelectedField(field);
  }, [selectedFieldId, fields]);

  // ==========================================
  // LOAD CROP HISTORY WHEN FIELD CHANGES
  // ==========================================

  useEffect(() => {
    if (selectedFieldId == null) return;

    let cancelled = false;

    async function loadHistory() {
      try {
        setIsLoadingHistory(true);

        const detail = await fetchField(selectedFieldId);

        if (!cancelled && detail?.crop_history) {
          setCropHistory(detail.crop_history);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            `Failed to load history for field ${selectedFieldId}:`,
            err,
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    // Avoid unnecessary fetching for the preloaded initial field
    if (selectedFieldId !== INITIAL_FIELDS[0]?.id || cropHistory.length === 0) {
      loadHistory();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedFieldId]);

  // ==========================================
  // SHARED DATA FOR CHILD ROUTES
  // ==========================================

  const outletContext = {
    // Field information
    fields,
    selectedField,
    selectedFieldId,
    setSelectedFieldId,

    // Crop history
    cropHistory,
    setCropHistory,
    isLoadingHistory,

    // NASA health
    health,

    // languageuage
    language,
    setlanguage,

    // Background preferences
    isBlurMode,
    setIsBlurMode,
  };

  // ==========================================
  // APPLICATION LAYOUT
  // ==========================================

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white transition-colors duration-300">
      {/* Background Canvas */}
      <BackgroundCanvas isBlurMode={isBlurMode} />

      {/* Navigation */}
      <Navbar
        language={language}
        setlanguage={setlanguage}
        health={health}
        fields={fields}
        selectedFieldId={selectedFieldId}
        setSelectedFieldId={setSelectedFieldId}
        isBlurMode={isBlurMode}
        setIsBlurMode={setIsBlurMode}
      />

      {/* Main Content */}
      <main className="w-full max-w-[99%] 2xl:max-w-[99.5%] mx-auto px-2 sm:px-3 md:px-4 py-2 sm:py-3.5 flex-1">
        {/* Backend Error */}
        {error && (
          <div className="bg-rose-950/50 border border-rose-800 p-4 rounded-xl text-xs text-rose-300 mb-6 flex items-center justify-between">
            <span>⚠ Error connecting to backend API: {error}</span>

            <button
              onClick={() => window.location.reload()}
              className="underline font-semibold ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Screen / Route Content */}
        {isLoadingFields ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />

            <p className="text-sm font-medium">
              Loading NASA Earth Observations & Bangladesh Fields...
            </p>
          </div>
        ) : (
          <Outlet context={outletContext} />
        )}
      </main>

      {/* Footer */}
      <Footer language={language} />
    </div>
  );
};

export default MainLayout;
