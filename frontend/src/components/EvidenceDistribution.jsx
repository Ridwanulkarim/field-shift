
const EvidenceDistribution = ({ evidence }) => {
  if (!evidence?.distributions) {
    return (
      <p className="text-sm text-gray-500">
        No additional details were returned.
      </p>
    );
  }

  const distributions = evidence.distributions;

  const formatDate = (day) => {
    if (day == null) return "—";

    const date = new Date(Date.UTC(2025, 0, Number(day)));
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  };

  const groups = [
    { key: "early", label: "Early years", color: "green" },
    { key: "late", label: "Late years", color: "blue" },
  ];

  const stats = [
    ["n", "Sample size"],
    ["min", "Minimum"],
    ["q1", "Q1"],
    ["median", "Median"],
    ["q3", "Q3"],
    ["max", "Maximum"],
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-500">
          Measurement unit
        </p>
        <p className="mt-1 text-sm font-medium text-gray-800">
          {evidence.unit === "day of a 365-day year (1 January = 1)"
            ? "Day of year (1 January = Day 1)"
            : evidence.unit || "Not specified"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map(({ key, label, color }) => {
          const item = distributions[key];
          if (!item) return null;

          const summary = item.summary || {};

          return (
            <div
              key={key}
              className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className={`border-b border-gray-200 p-4 ${
                color === "green" ? "bg-green-50" : "bg-blue-50"
              }`}>
                <p className="text-sm font-semibold text-gray-800">
                  {label}
                </p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {item.years ?? 0}
                </p>
                <p className="text-xs text-gray-500">
                  Total years
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4">
                {[
                  ["Confirmed", item.confirmedYears],
                  ["Censored", item.censoredYears],
                  ["Unknown", item.unknownYears],
                ].map(([name, value]) => (
                  <div key={name} className="min-w-0">
                    <p className="text-xs text-gray-500">{name}</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 p-4">
                <h4 className="mb-3 text-sm font-semibold text-gray-800">
                  Statistical summary
                </h4>

                <div className="space-y-2">
                  {stats.map(([keyName, labelName]) => (
                    <div
                      key={keyName}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-gray-500">
                        {labelName}
                      </span>
                      <span className="font-semibold text-gray-800 tabular-nums">
                        {summary[keyName] ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-600">
                    Date equivalents
                  </p>
                  {[
                    ["Q1 date", summary.q1Date],
                    ["Median date", summary.medianDate],
                    ["Q3 date", summary.q3Date],
                  ].map(([name, value]) => (
                    <div
                      key={name}
                      className="mt-2 flex justify-between gap-2 text-sm"
                    >
                      <span className="text-gray-500">{name}</span>
                      <span className="font-medium text-gray-800">
                        {value || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {Array.isArray(item.valuesDayOfYear) && (
                <div className="border-t border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Observed values
                  </h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.valuesDayOfYear.map((value, index) => (
                      <span
                        key={`${value}-${index}`}
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
