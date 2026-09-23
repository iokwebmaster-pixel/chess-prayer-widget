const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZ6eFrjM2yI9k-wmavgmngMPNpPiBeQ0Ywy7QG6EWRtz1jwJ7ET-UhsXqfcvDUCSaLmLT2JHhBKVTf/pub?output=csv";
function parseCSV(csv: string) {
  const lines = csv.trim().split("\n");

  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");

    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || "";
    });

    return row;
  });
}

// --------------------------------
// Fetch Google Sheet
// --------------------------------
async function fetchGoogleSheet() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(CSV_URL, {
        cache: "no-store",
      });

      // Google Sheets worked
      if (response.ok) {
        return response;
      }

      console.error(
        `Google Sheets attempt ${attempt}: ${response.status} ${response.statusText}`
      );

      // Only retry temporary server errors
      if (
        response.status !== 502 &&
        response.status !== 503 &&
        response.status !== 504
      ) {
        throw new Error(
          `Google Sheets returned ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(
        `Google Sheets attempt ${attempt} failed:`,
        error
      );

      // If this is the final attempt, stop
      if (attempt === 3) {
        throw error;
      }
    }

    // Wait 1 second before retrying
    if (attempt < 3) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000)
      );
    }
  }

  throw new Error("Google Sheets failed after 3 attempts");
}

// --------------------------------
// Get California date as YYYY-MM-DD
// --------------------------------
function getCaliforniaDate() {
  const now = new Date();

  const californiaDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const month = californiaDate.find(
    (part) => part.type === "month"
  )?.value;

  const day = californiaDate.find(
    (part) => part.type === "day"
  )?.value;

  const year = californiaDate.find(
    (part) => part.type === "year"
  )?.value;

  return `${year}-${month}-${day}`;
}

// --------------------------------
// Find next Friday
// --------------------------------
function getNextFriday(dateString: string) {
  // Use UTC here so the date does not shift because
  // of the server's timezone.
  const date = new Date(`${dateString}T12:00:00Z`);

  const dayOfWeek = date.getUTCDay();

  // Friday = 5
  // If today is Friday, use today.
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;

  date.setUTCDate(date.getUTCDate() + daysUntilFriday);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function GET() {
  try {
    // --------------------------------
    // Get the CSV from Google Sheets
    // --------------------------------
    const response = await fetchGoogleSheet();

    const csv = await response.text();

    // Convert CSV into JavaScript objects
    const rows = parseCSV(csv);

    // --------------------------------
    // Get today's date in California
    // --------------------------------
    const todayString = getCaliforniaDate();

    // --------------------------------
    // Find today's row
    // --------------------------------
    const todayRow = rows.find((row) => {
      return row.Date?.trim() === todayString;
    });

    if (!todayRow) {
      return Response.json(
        {
          error: "Prayer times for today were not found",
          date: todayString,
        },
        { status: 404 }
      );
    }

    // --------------------------------
    // Find next Friday
    // --------------------------------
    const nextFridayString = getNextFriday(todayString);

    // --------------------------------
    // Find next Friday's row
    // --------------------------------
    const nextFridayRow = rows.find((row) => {
      return row.Date?.trim() === nextFridayString;
    });

    // --------------------------------
    // Get Jumuah information
    // --------------------------------
    const jumuah = nextFridayRow
      ? {
          date: nextFridayRow.Date,
          time: nextFridayRow["Jumuah Prayer Time"],
          khatib: nextFridayRow["Khatib"],
        }
      : null;

    // --------------------------------
    // Return today's prayer times
    // + next Friday's Jumuah information
    // --------------------------------
    return Response.json(
      {
        date: todayRow.Date,

        prayers: [
          {
            name: "Fajr",
            time: todayRow.Fajr,
            iqama: todayRow["Fajr Iqama"],
          },
          {
            name: "Sunrise",
            time: todayRow.Sunrise,
            iqama: null,
          },
          {
            name: "Ẓuhr",
            time: todayRow.Dhuhr,
            iqama: todayRow["Dhuhr Iqama"],
          },
          {
            name: "ʿAṣr",
            time: todayRow.Asr,
            iqama: todayRow["Asr Iqama"],
          },
          {
            name: "Maghrib",
            time: todayRow.Maghrib,
            iqama: todayRow["Maghrib Iqama"],
          },
          {
            name: "ʿIshāʾ",
            time: todayRow.Ishaa,
            iqama: todayRow["Ishaa Iqama"],
          },
        ],

        jumuah,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Prayer API error:", error);

    return Response.json(
      {
        error: "Unable to load prayer times",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}