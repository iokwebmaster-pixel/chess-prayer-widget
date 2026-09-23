"use client";

import { useEffect, useRef, useState } from "react";

type Prayer = {
  name: string;
  time: string;
  iqama: string | null;
};

type Jumuah = {
  date: string;
  time: string;
  khatib: string;
};

const icons: Record<string, string> = {
  Fajr: "☼",
  Sunrise: "☀︎",
  Ẓuhr: "☼",
  ʿAṣr: "○",
  Maghrib: "◒",
  ʿIshāʾ: "☾",
};

export default function Home() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [date, setDate] = useState("");
  const [jumuah, setJumuah] = useState<Jumuah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Tracks whether we have successfully loaded prayer data
  const hasLoadedPrayers = useRef(false);

  // --------------------------------
  // Fetch prayer times
  // --------------------------------
  useEffect(() => {
    async function fetchPrayers() {
      try {
        const response = await fetch("/api/prayers", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch Google Sheet: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();

        setPrayers(data.prayers);
        setDate(data.date);
        setJumuah(data.jumuah || null);
        setError("");

        // We successfully loaded prayer data
        hasLoadedPrayers.current = true;
      } catch (error) {
        console.error("Prayer API error:", error);

        // Only show an error if prayer data has NEVER loaded
        if (!hasLoadedPrayers.current) {
          setError("Unable to load prayer times.");
        }
      } finally {
        setLoading(false);
      }
    }

    // Fetch immediately
    fetchPrayers();

    // Refresh prayer data every minute
    const refreshInterval = setInterval(() => {
      fetchPrayers();
    }, 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // --------------------------------
  // Update clock every second
  // --------------------------------
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(clockInterval);
    };
  }, []);

  // --------------------------------
  // Convert prayer time to minutes
  // --------------------------------
  const getPrayerMinutes = (time: string) => {
    const [timePart, modifier] = time.trim().split(" ");

    if (!timePart) return null;

    let [hours, minutes] = timePart.split(":").map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    if (modifier?.toUpperCase() === "PM" && hours !== 12) {
      hours += 12;
    }

    if (modifier?.toUpperCase() === "AM" && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  };

  // --------------------------------
  // Get current time in California
  // --------------------------------
  const californiaTimeString = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).format(currentTime);

  const [californiaHours, californiaMinutes] =
    californiaTimeString.split(":").map(Number);

  const nowMinutes = californiaHours * 60 + californiaMinutes;

  // --------------------------------
  // Determine if today is Friday
  // --------------------------------
  const californiaDay = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
  }).format(currentTime);

  const isFriday = californiaDay === "Friday";

  // --------------------------------
  // Find the current prayer
  // --------------------------------
  let currentPrayerIndex = -1;

  for (let i = 0; i < prayers.length; i++) {
    const prayerMinutes = getPrayerMinutes(prayers[i].time);

    if (prayerMinutes === null) continue;

    if (prayerMinutes <= nowMinutes) {
      currentPrayerIndex = i;
    }
  }

  // --------------------------------
  // Loading state
  // --------------------------------
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent">
        <p>Loading...</p>
      </main>
    );
  }

  // --------------------------------
  // Error state
  // --------------------------------
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent">
        <p>{error}</p>
      </main>
    );
  }

  // --------------------------------
  // Main widget
  // --------------------------------
  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent">
      <div className="w-full max-w-[380px] rounded-[24px] border border-[#D9CF91] bg-[#F0EEC7] px-4 py-3 shadow-sm">

        {/* Header */}
        <div className="rounded-full bg-[#CAA41A] px-4 py-2 text-center">
          <span className="text-[17px] font-semibold text-white">
            IOK |{" "}
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Column Headers */}
        <div className="mt-2 grid grid-cols-[1fr_72px_72px] items-center px-2 text-[13px]">
          <div className="text-[#777777]">
            Updated today
          </div>

          <div className="text-center font-semibold text-[#333333]">
            Adhān
          </div>

          <div className="text-center font-semibold text-[#333333]">
            Iqāmah
          </div>
        </div>

        {/* Prayer Rows */}
        <div className="mt-1">
          {prayers.map((prayer, index) => {
            const isCurrentPrayer =
              index === currentPrayerIndex;

            const displayName =
              prayer.name === "Ẓuhr" && isFriday
                ? "Jumuʿah"
                : prayer.name;

            return (
              <div
                key={prayer.name}
                className="grid grid-cols-[1fr_72px_72px] items-center px-2 py-[5px]"
              >

                {/* Prayer Name */}
                <div className="flex items-center gap-2">
                  <span
                    className={`flex w-5 justify-center text-[18px] ${
                      isCurrentPrayer
                        ? "text-[#9A7628]"
                        : "text-[#CAA41A]"
                    }`}
                  >
                    {icons[prayer.name] || "○"}
                  </span>

                  <span
                    className={`text-[15px] font-medium ${
                      isCurrentPrayer
                        ? "font-semibold text-[#9A7628]"
                        : "text-[#333333]"
                    }`}
                  >
                    {displayName}
                  </span>
                </div>

                {/* Adhān */}
                <div
                  className={`text-center text-[15px] ${
                    isCurrentPrayer
                      ? "font-semibold text-[#9A7628]"
                      : "text-[#333333]"
                  }`}
                >
                  {prayer.time}
                </div>

                {/* Iqāmah */}
                <div
                  className={`text-center text-[15px] ${
                    isCurrentPrayer
                      ? "font-semibold text-[#9A7628]"
                      : "text-[#333333]"
                  }`}
                >
                  {prayer.iqama || "—"}
                </div>

              </div>
            );
          })}
        </div>
        {/* Upcoming Friday Khatib */}
        {jumuah?.khatib && (
          <div className="mt-1 px-2 text-right text-[11px] text-[#777777]">
            Khaṭīb: {jumuah.khatib}
          </div>
        )}

      </div>
    </main>
  );
}