"use client";
import { useEffect, useState } from "react";

/** Sends the browser's time zone with the goals form, so plan days follow the user's clock. */
export function TimeZoneInput() {
  const [tz, setTz] = useState("");
  useEffect(() => {
    // The zone is only known in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  }, []);
  return <input type="hidden" name="timeZone" value={tz} />;
}
