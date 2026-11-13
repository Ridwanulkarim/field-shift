import { createContext, useCallback, useContext, useMemo, useState } from "react";

// The district and crop a person has chosen, shared by every page and remembered between visits, so nobody picks
// "Rajshahi" four times. Stored in localStorage; every read and write is wrapped because storage can be blocked.

const KEY = "fieldShiftSelection";
const SelectionContext = createContext(null);

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      district: typeof value.district === "string" ? value.district : "",
      crop: typeof value.crop === "string" ? value.crop : "",
    };
  } catch {
    return { district: "", crop: "" };
  }
}

export function SelectionProvider({ children }) {
  const [selection, setSelection] = useState(read);

  const update = useCallback((patch) => {
    setSelection((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep the choice in memory only */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...selection, update }), [selection, update]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export const useSelection = () => useContext(SelectionContext);
