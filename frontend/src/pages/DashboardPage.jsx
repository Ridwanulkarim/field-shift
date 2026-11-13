import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Database,
  MapPinned,
  Satellite,
  XCircle,
} from "lucide-react";
import { PageHeading, StatCard, Card, SectionHeading } from "../components/UI";
import { useLanguage } from "../layouts/context/LanguageContext";
import useAxios from "../hooks/useAxios"; // Adjust this path if needed

const translations = {
  en: {
    eyebrow: "OVERVIEW",
    title: "Field dashboard",
    description:
      "Backend health, district coverage, and environmental data status.",
    dataMode: "Data mode",
    failedRuns: "Recent failed runs",
    healthEndpoint: "Health endpoint",
    operatingMode: "Operating mode",
    availableDistricts: "Districts with available data",
    reportedByEndpoint: "Reported by data health endpoint",
    nasaTitle: "NASA data availability",
    nasaDescription:
      "Ingestion status and observation coverage reported by the backend.",
    upstreamService: "Upstream service",
    upstreamStatus: "Upstream status",
    nasaDistricts: "NASA data districts",
    syntheticDistricts: "Synthetic data districts",
    noDataDistricts: "No data districts",
    notChecked:
      "The upstream service was not checked; this is not a live NASA connectivity test.",
    serviceDetails: "Service details",
    serviceDescription: "Backend connection and application configuration.",
    service: "Service",
    lastHealthCheck: "Last health check",
    configuration: "Configuration",
    loaded: "Loaded",
    districtTitle: "District data coverage",
    districtDescription:
      "Latest observation date and data-quality counts reported for each district.",
    observation: "Latest observation",
    missingRecords: "Missing records",
    rows: "Rows",
    daysSince: "Days since latest",
    dataSource: "Data source",
    ingestionTitle: "Recent ingestion failures",
    ingestionDescription: "Failures reported by the data health endpoint.",
    noFailures: "No recent failed runs reported.",
    noDistricts: "No district health data is available.",
    loading: "Loading…",
    unavailable: "Unavailable",
    unknown: "Unknown",
    degradedWarning:
      "The backend reports degraded or fallback operation. Check the data mode and district details before interpreting the data.",
    partialError: "Some dashboard information could not be loaded.",
    retry: "Retry",
    statusAvailable: "Available",
    statusUnavailable: "Unavailable",
    statusFailed: "Failed",
    failedRun: "Failed ingestion run",
  },
  bn: {
    eyebrow: "সারসংক্ষেপ",
    title: "কৃষি জমির ড্যাশবোর্ড",
    description: "ব্যাকএন্ডের অবস্থা, জেলার ডেটা এবং পরিবেশগত তথ্যের অবস্থা।",

    dataMode: "ডেটা মোড",

    failedRuns: "সাম্প্রতিক ব্যর্থ রান",
    healthEndpoint: "হেলথ এন্ডপয়েন্ট",
    operatingMode: "চালু মোড",
    availableDistricts: "ডেটা উপলভ্য এমন জেলা",
    reportedByEndpoint: "ডেটা হেলথ এন্ডপয়েন্টের তথ্য",
    nasaTitle: "NASA ডেটার উপলভ্যতা",
    nasaDescription: "ব্যাকএন্ডে জানানো ডেটা সংগ্রহ ও পর্যবেক্ষণের অবস্থা।",
    upstreamService: "আপস্ট্রিম সার্ভিস",
    upstreamStatus: "আপস্ট্রিমের অবস্থা",
    nasaDistricts: "NASA ডেটাযুক্ত জেলা",
    syntheticDistricts: "সিন্থেটিক ডেটাযুক্ত জেলা",
    noDataDistricts: "ডেটাবিহীন জেলা",
    notChecked:
      "আপস্ট্রিম সার্ভিস পরীক্ষা করা হয়নি; এটি NASA-র সঙ্গে লাইভ সংযোগ পরীক্ষা নয়।",
    serviceDetails: "সার্ভিসের বিবরণ",
    serviceDescription: "ব্যাকএন্ড সংযোগ ও অ্যাপ কনফিগারেশন।",
    service: "সার্ভিস",
    lastHealthCheck: "সর্বশেষ হেলথ পরীক্ষা",
    configuration: "কনফিগারেশন",
    loaded: "লোড হয়েছে",
    districtTitle: "জেলার ডেটা কভারেজ",
    districtDescription:
      "প্রতিটি জেলার সর্বশেষ পর্যবেক্ষণের তারিখ ও ডেটার মানসংক্রান্ত তথ্য।",
    observation: "সর্বশেষ পর্যবেক্ষণ",
    missingRecords: "অনুপস্থিত রেকর্ড",
    rows: "সারি",
    daysSince: "সর্বশেষ পর্যবেক্ষণের পর দিন",
    dataSource: "ডেটার উৎস",
    ingestionTitle: "সাম্প্রতিক ডেটা সংগ্রহের ব্যর্থতা",
    ingestionDescription: "ডেটা হেলথ এন্ডপয়েন্টে জানানো ব্যর্থতা।",
    noFailures: "সাম্প্রতিক কোনো ব্যর্থ রান নেই।",
    noDistricts: "জেলার কোনো স্বাস্থ্য-সংক্রান্ত ডেটা উপলভ্য নেই।",
    loading: "লোড হচ্ছে…",
    unavailable: "উপলভ্য নয়",
    unknown: "অজানা",
    degradedWarning:
      "ব্যাকএন্ডে সীমিত বা বিকল্প মোড চলছে। ডেটা ব্যাখ্যা করার আগে মোড ও জেলার বিবরণ দেখুন।",
    partialError: "ড্যাশবোর্ডের কিছু তথ্য লোড করা যায়নি।",
    retry: "আবার চেষ্টা করুন",
    statusAvailable: "উপলভ্য",
    statusUnavailable: "উপলভ্য নয়",
    statusFailed: "ব্যর্থ",
    failedRun: "ডেটা সংগ্রহের রান ব্যর্থ হয়েছে",
  },
};

const formatDate = (value, language) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(language === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
};

const formatNumber = (value, language) =>
  typeof value === "number"
    ? value.toLocaleString(language === "bn" ? "bn-BD" : "en-GB")
    : "—";

const Detail = ({ label, value }) => (
  <div className="flex flex-wrap items-start justify-between gap-2">
    <span className="text-gray-500">{label}</span>
    <strong className="text-right font-medium text-gray-900">{value}</strong>
  </div>
);

const DashboardPage = () => {
  const { language } = useLanguage();

  const t = translations[language] ?? translations.en;
  const api = useAxios();

  const [dashboard, setDashboard] = useState({
    health: null,
    dataHealth: null,
    meta: null,
  });
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setHasError(false);

    const results = await Promise.allSettled([
      api.get("/health"),
      api.get("/health/data"),
      api.get("/districts"),
      api.get("/meta"),
    ]);

    const [healthResult, dataHealthResult, districtsResult, metaResult] =
      results;

    setDashboard({
      health:
        healthResult.status === "fulfilled" ? healthResult.value.data : null,
      dataHealth:
        dataHealthResult.status === "fulfilled"
          ? dataHealthResult.value.data
          : null,
      // Retained for district overview/configuration if needed.
      // Health metrics below use dataHealth.districts.
      districts:
        districtsResult.status === "fulfilled"
          ? (districtsResult.value.data?.districts ??
            districtsResult.value.data ??
            [])
          : [],
      meta: metaResult.status === "fulfilled" ? metaResult.value.data : null,
    });

    setHasError(results.some((result) => result.status === "rejected"));
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setHasError(false);

      const results = await Promise.allSettled([
        api.get("/health"),
        api.get("/health/data"),
        api.get("/districts"),
        api.get("/meta"),
      ]);

      if (cancelled) return;

      const [healthResult, dataHealthResult, districtsResult, metaResult] =
        results;

      setDashboard({
        health:
          healthResult.status === "fulfilled" ? healthResult.value.data : null,
        dataHealth:
          dataHealthResult.status === "fulfilled"
            ? dataHealthResult.value.data
            : null,
        districts:
          districtsResult.status === "fulfilled"
            ? (districtsResult.value.data?.districts ??
              districtsResult.value.data ??
              [])
            : [],
        meta: metaResult.status === "fulfilled" ? metaResult.value.data : null,
      });

      setHasError(results.some((result) => result.status === "rejected"));
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [api]);

  const { health, dataHealth, meta } = dashboard;

  const localizedValue = (value) => ({
    database: "ডেটাবেস",
    "offline-files": "অফলাইন ফাইল",
    "database-with-offline-fallback": "ডেটাবেস ও অফলাইন বিকল্প",
    nasa: "NASA",
    synthetic: "সিন্থেটিক",
    none: "কোনোটিই নয়",
    cached: "ক্যাশ করা",
    demo: "ডেমো",
    unavailable: "উপলভ্য নয়",
    not_checked: "পরীক্ষা করা হয়নি",
    ok: "ঠিক আছে",
    "field-shift-backend": "ফিল্ড শিফট ব্যাকএন্ড",
  }[value] ?? value);

  // These records contain latestObservationDate, missingCount, rowCount, etc.
  const healthDistricts = Array.isArray(dataHealth?.districts)
    ? dataHealth.districts
    : [];
  const failedRuns = Array.isArray(dataHealth?.recentFailedRuns)
    ? dataHealth.recentFailedRuns
    : [];
  const tally = dataHealth?.tally ?? {};
  const degraded = Boolean(dataHealth?.degraded || health?.degraded);
  const availableCount = Number(tally.nasa ?? 0) + Number(tally.synthetic ?? 0);

  const stats = [
    {
      label: t.backendStatus,
      value: health?.status ?? (loading ? t.loading : t.unavailable),
      detail: health?.service ?? t.healthEndpoint,
      icon: Activity,
      tone: health?.status === "ok" ? "blue" : "amber",
    },
    {
      label: t.dataMode,
      value: dataHealth?.dataMode ?? health?.dataMode ?? "—",
      detail: degraded ? "Degraded / fallback" : t.operatingMode,
      icon: Database,
      tone: degraded ? "amber" : undefined,
    },
    {
      label: t.districtCoverage,
      value: healthDistricts.length
        ? `${availableCount} / ${healthDistricts.length}`
        : "—",
      detail: t.availableDistricts,
      icon: MapPinned,
    },
    {
      label: t.failedRuns,
      value: formatNumber(failedRuns.length),
      detail: t.reportedByEndpoint,
      icon: CloudRain,
      tone: failedRuns.length ? "amber" : undefined,
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      {hasError && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {t.partialError}
          </span>
          <button
            type="button"
            onClick={loadDashboard}
            className="rounded-md border border-amber-400 px-3 py-1.5 font-medium hover:bg-amber-100"
          >
            {t.retry}
          </button>
        </div>
      )}

      {degraded && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <span>{t.degradedWarning}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading title={t.nasaTitle} description={t.nasaDescription} />

          <div className="mt-4 space-y-3 text-sm">
            <Detail
              label={t.upstreamService}
              value={localizedValue(dataHealth?.upstream?.service ?? "—")}
            />
            <Detail
              label={t.upstreamStatus}
              value={
                localizedValue(
                  dataHealth?.upstream?.status ??
                    (dataHealth?.upstream?.checked === false ? "not_checked" : "—"),
                )
              }
            />
            <Detail label={t.nasaDistricts} value={formatNumber(tally.nasa, language)} />
            <Detail
              label={t.syntheticDistricts}
              value={formatNumber(tally.synthetic, language)}
            />
            <Detail
              label={t.noDataDistricts}
              value={formatNumber(tally.none, language)}
            />
          </div>

          {dataHealth?.upstream?.checked === false && (
            <p className="mt-4 text-sm text-gray-500">{t.notChecked}</p>
          )}
        </Card>

        <Card>
          <SectionHeading
            title={t.serviceDetails}
            description={t.serviceDescription}
          />

          <div className="mt-4 space-y-3 text-sm">
            <Detail
              label={t.service}
              value={localizedValue(health?.service ?? "—")}
            />
            <Detail
              label={t.lastHealthCheck}
              value={formatDate(health?.timestamp, language)}
            />
            <Detail
              label={t.operatingMode}
              value={localizedValue(dataHealth?.dataMode ?? health?.dataMode ?? "—")}
            />
            <Detail
              label={t.configuration}
              value={meta ? t.loaded : loading ? t.loading : t.unavailable}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <SectionHeading
          title={t.districtTitle}
          description={t.districtDescription}
        />

        {loading && healthDistricts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t.loading}</p>
        ) : healthDistricts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t.noDistricts}</p>
        ) : (
          <div className="mt-4 divide-y divide-gray-200">
            {healthDistricts.map((district, index) => {
              const status = district.dataStatus;
              const isAvailable = status === "nasa" || status === "synthetic";
              const districtName =
                district.nameBn ??
                district.name ??
                district.slug ??
                `${t.districtTitle} ${index + 1}`;

              return (
                <article
                  key={district.slug ?? district.id ?? index}
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {districtName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {                        localizedValue(
                          district.dataStatus ??
                            district.climateData ??
                            t.unknown,
                        )}
                      </p>
                    </div>

                    {isAvailable ? (
                      <CheckCircle2
                        className="shrink-0 text-green-600"
                        size={20}
                        aria-label={t.statusAvailable}
                      />
                    ) : (
                      <XCircle
                        className="shrink-0 text-gray-400"
                        size={20}
                        aria-label={t.statusUnavailable}
                      />
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <Detail
                      label={t.observation}
                      value={formatDate(district.latestObservationDate, language)}
                    />
                    <Detail
                      label={t.missingRecords}
                      value={formatNumber(district.missingCount, language)}
                    />
                    <Detail
                      label={t.rows}
                      value={formatNumber(district.rowCount, language)}
                    />
                    <Detail
                      label={t.daysSince}
                      value={formatNumber(district.daysSinceLatest, language)}
                    />
                    <Detail
                      label={t.dataSource}
                      value={localizedValue(district.climateData ?? "—")}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <SectionHeading
          title={t.ingestionTitle}
          description={t.ingestionDescription}
        />

        {loading && failedRuns.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t.loading}</p>
        ) : failedRuns.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t.noFailures}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {failedRuns.map((run, index) => (
              <li
                key={
                  run.id ?? run.runId ?? `${run.timestamp ?? "run"}-${index}`
                }
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <Satellite
                  className="mt-0.5 shrink-0 text-amber-600"
                  size={17}
                />
                <span>
                  {run.message ?? run.error ?? run.status ?? t.failedRun}
                  {run.timestamp && ` — ${formatDate(run.timestamp, language)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

export default DashboardPage;
