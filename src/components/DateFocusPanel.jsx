import { useEffect, useMemo, useRef, useState } from "react";
import { C, card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseIsoDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return startOfDay(date);
}

function toIsoDate(value) {
  const date = startOfDay(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(value) {
  return startOfDay(new Date(value.getFullYear(), value.getMonth(), 1));
}

function addMonths(value, offset) {
  return startOfMonth(new Date(value.getFullYear(), value.getMonth() + offset, 1));
}

function isSameDay(left, right) {
  if (!left || !right) {
    return false;
  }
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isBeforeDay(left, right) {
  return startOfDay(left).getTime() < startOfDay(right).getTime();
}

function maxDay(left, right) {
  return isBeforeDay(left, right) ? right : left;
}

function getCalendarDays(monthDate) {
  const firstDayOfMonth = startOfMonth(monthDate);
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7;
  const firstVisibleDay = new Date(firstDayOfMonth);
  firstVisibleDay.setDate(firstDayOfMonth.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisibleDay);
    day.setDate(firstVisibleDay.getDate() + index);
    return startOfDay(day);
  });
}

function isInVisibleMonth(day, visibleMonth) {
  return day.getFullYear() === visibleMonth.getFullYear() && day.getMonth() === visibleMonth.getMonth();
}

function formatDisplayDate(value, fallback = "Datum auswählen") {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return fallback;
  }
  return DISPLAY_DATE_FORMATTER.format(parsed);
}

function buildRangeLabel(fromDate, toDate) {
  const fromLabel = formatDisplayDate(fromDate, "n/a");
  const toLabel = formatDisplayDate(toDate, "n/a");
  return `${fromLabel} bis ${toLabel}`;
}

export function DateFocusPanel({ fromDate, toDate, onFromDate, onToDate }) {
  const calendarRef = useRef(null);
  const fromToggleRef = useRef(null);
  const toToggleRef = useRef(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeField, setActiveField] = useState("from");
  const [calendarPlacement, setCalendarPlacement] = useState("bottom");

  const selectedFromDate = useMemo(() => parseIsoDate(fromDate), [fromDate]);
  const selectedToDate = useMemo(() => parseIsoDate(toDate), [toDate]);
  const activeSelectedDate = activeField === "to" ? selectedToDate : selectedFromDate;
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedFromDate || selectedToDate || today));

  useEffect(() => {
    if (!isCalendarOpen) {
      const seedDate = activeField === "to" ? selectedToDate || selectedFromDate : selectedFromDate || selectedToDate;
      setVisibleMonth(startOfMonth(seedDate || today));
    }
  }, [activeField, isCalendarOpen, selectedFromDate, selectedToDate, today]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return undefined;
    }

    const updatePlacement = () => {
      const activeRef = activeField === "to" ? toToggleRef.current : fromToggleRef.current;
      const rect = activeRef?.getBoundingClientRect();
      if (!rect) {
        setCalendarPlacement("bottom");
        return;
      }

      const preferredCalendarHeight = 390;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < preferredCalendarHeight && spaceAbove > spaceBelow) {
        setCalendarPlacement("top");
      } else {
        setCalendarPlacement("bottom");
      }
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [activeField, isCalendarOpen]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return undefined;
    }

    const onDocPointerDown = (event) => {
      const target = event.target;
      if (!calendarRef.current || calendarRef.current.contains(target)) {
        return;
      }
      setIsCalendarOpen(false);
    };

    const onDocKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onDocKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [isCalendarOpen]);

  const monthLabel = useMemo(() => MONTH_LABEL_FORMATTER.format(visibleMonth), [visibleMonth]);
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const todayIso = toIsoDate(today);
  const minToDate = selectedFromDate ? maxDay(today, selectedFromDate) : today;
  const minToDateIso = toIsoDate(minToDate);
  const activeMinDate = activeField === "to" ? minToDate : today;

  const openCalendar = (field) => {
    setActiveField(field);
    const seedDate = field === "to" ? selectedToDate || selectedFromDate : selectedFromDate || selectedToDate;
    setVisibleMonth(startOfMonth(seedDate || today));
    setIsCalendarOpen(true);
  };

  const onSelectCalendarDay = (day) => {
    if (isBeforeDay(day, activeMinDate)) {
      return;
    }

    const nextIso = toIsoDate(day);
    if (activeField === "to") {
      onToDate(nextIso);
    } else {
      onFromDate(nextIso);
    }
    setIsCalendarOpen(false);
  };

  return (
    <div style={{ ...card, overflow: "visible", zIndex: isCalendarOpen ? 120 : "auto" }}>
      <SectionHeader num="04">Zeitraum</SectionHeader>

      <div ref={calendarRef} style={{ position: "relative", zIndex: isCalendarOpen ? 120 : "auto" }}>
        <div className="date-focus-row">
          <div>
            <label htmlFor="scouting-from-date" style={lbl}>
              Scouting ab
            </label>
            <button
              id="scouting-from-date"
              ref={fromToggleRef}
              type="button"
              aria-label="Scouting-Datum auswählen"
              aria-expanded={isCalendarOpen && activeField === "from"}
              onClick={() => openCalendar("from")}
              style={{
                ...inp,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 15,
                padding: "12px 14px",
                minHeight: 52,
              }}
            >
              <span>{formatDisplayDate(fromDate)}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          <div>
            <label htmlFor="scouting-to-date" style={lbl}>
              Scouting bis
            </label>
            <button
              id="scouting-to-date"
              ref={toToggleRef}
              type="button"
              aria-label="Scouting-Bis-Datum auswählen"
              aria-expanded={isCalendarOpen && activeField === "to"}
              onClick={() => openCalendar("to")}
              style={{
                ...inp,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 15,
                padding: "12px 14px",
                minHeight: 52,
              }}
            >
              <span>{formatDisplayDate(toDate)}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <input
              type="date"
              aria-label="Scouting-Bis direkt eingeben"
              value={toDate}
              min={minToDateIso}
              onChange={(event) => onToDate(event.target.value)}
              style={{
                ...inp,
                marginTop: 8,
                minHeight: 40,
                padding: "8px 10px",
                fontSize: 12,
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: C.gray }}>
          Zeitraum: {buildRangeLabel(fromDate, toDate)}
        </div>

        <input
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={fromDate}
          min={todayIso}
          onChange={(event) => onFromDate(event.target.value)}
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            width: 0,
            height: 0,
          }}
        />

        {isCalendarOpen ? (
          <div
            role="dialog"
            aria-label="Kalenderauswahl"
            style={{
              position: "absolute",
              top: calendarPlacement === "bottom" ? "calc(100% + 10px)" : "auto",
              bottom: calendarPlacement === "top" ? "calc(100% + 10px)" : "auto",
              left: 0,
              width: "min(420px, calc(100vw - 56px))",
              maxHeight: "min(420px, calc(100vh - 120px))",
              overflowY: "auto",
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              background: C.surfaceSolid,
              boxShadow: "0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02) inset",
              padding: 14,
              zIndex: 140,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button
                type="button"
                aria-label="Vorheriger Monat"
                onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
                style={{
                  border: `1px solid ${C.border}`,
                  background: "rgba(255,255,255,0.03)",
                  color: C.gray,
                  borderRadius: 8,
                  width: 38,
                  minHeight: 38,
                  cursor: "pointer",
                }}
              >
                ‹
              </button>

              <div
                style={{
                  color: C.offWhite,
                  fontSize: 15,
                  fontWeight: 700,
                  textTransform: "capitalize",
                }}
              >
                {monthLabel}
              </div>

              <button
                type="button"
                aria-label="Nächster Monat"
                onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                style={{
                  border: `1px solid ${C.border}`,
                  background: "rgba(255,255,255,0.03)",
                  color: C.gray,
                  borderRadius: 8,
                  width: 38,
                  minHeight: 38,
                  cursor: "pointer",
                }}
              >
                ›
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 6,
                marginBottom: 6,
              }}
            >
              {WEEKDAY_LABELS.map((weekday) => (
                <div
                  key={weekday}
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color: C.gray,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontWeight: 700,
                  }}
                >
                  {weekday}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {calendarDays.map((day) => {
                const inMonth = isInVisibleMonth(day, visibleMonth);
                const isToday = isSameDay(day, today);
                const isSelected = activeSelectedDate ? isSameDay(day, activeSelectedDate) : false;
                const isDisabled = isBeforeDay(day, activeMinDate);

                return (
                  <button
                    type="button"
                    key={toIsoDate(day)}
                    aria-label={`Datum ${DISPLAY_DATE_FORMATTER.format(day)} auswählen`}
                    disabled={isDisabled}
                    onClick={() => onSelectCalendarDay(day)}
                    style={{
                      minHeight: 42,
                      borderRadius: 9,
                      border: `1px solid ${
                        isSelected
                          ? C.greenBorder
                          : isToday
                            ? "rgba(0,200,83,0.35)"
                            : "rgba(255,255,255,0.06)"
                      }`,
                      background: isSelected ? C.green : "rgba(255,255,255,0.03)",
                      color: isSelected
                        ? C.bg
                        : isDisabled
                          ? C.grayDark
                          : inMonth
                            ? C.offWhite
                            : C.gray,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      fontWeight: isSelected ? 700 : isToday ? 600 : 500,
                      opacity: inMonth ? 1 : 0.75,
                      transition: "all 0.15s ease",
                      fontSize: 13,
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 }}>
              <div style={{ fontSize: 11, color: C.gray }}>
                Heute: {DISPLAY_DATE_FORMATTER.format(today)}
              </div>
              <button
                type="button"
                onClick={() => {
                  const minDate = activeField === "to" ? minToDate : today;
                  const nextIso = toIsoDate(minDate);
                  if (activeField === "to") {
                    onToDate(nextIso);
                  } else {
                    onFromDate(nextIso);
                  }
                  setVisibleMonth(startOfMonth(minDate));
                  setIsCalendarOpen(false);
                }}
                style={{
                  border: `1px solid ${C.greenBorder}`,
                  background: C.greenDim,
                  color: C.green,
                  borderRadius: 8,
                  minHeight: 34,
                  padding: "0 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Heute wählen
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
