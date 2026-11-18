"use strict";

const STATUS_LABELS = {
  available: "○ 空き",
  booked: "× 予約済",
  check: "△ 要確認",
  closed: "— 休館／対象外",
};
const TIME_SLOTS = ["morning", "afternoon", "evening"];
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const $ = (id) => document.getElementById(id);

let data;
let recordsByDateAndVenue;
let displayStart;
let displayEnd;

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

// 不正なデータを空きとして扱わないよう、表示する前に検証する。
function validateData(input) {
  if (
    !input ||
    !Array.isArray(input.holidays) ||
    input.holidays.some((date) => !isValidDate(date)) ||
    !input.period ||
    !isValidDate(input.period.start) ||
    !isValidDate(input.period.end) ||
    input.period.start > input.period.end ||
    !Number.isFinite(Date.parse(input.updatedAt)) ||
    !Array.isArray(input.venues) ||
    input.venues.length === 0 ||
    !Array.isArray(input.records)
  ) {
    throw new Error("公開データの形式が正しくありません。");
  }

  const venueIds = new Set();
  for (const venue of input.venues) {
    if (
      typeof venue.id !== "string" || !venue.id ||
      typeof venue.name !== "string" || !venue.name ||
      venueIds.has(venue.id)
    ) {
      throw new Error("会場情報が正しくありません。");
    }
    venueIds.add(venue.id);
  }

  const recordKeys = new Set();
  for (const record of input.records) {
    const key = `${record.date}|${record.venueId}`;
    if (
      !isValidDate(record.date) ||
      record.date < input.period.start || record.date > input.period.end ||
      !venueIds.has(record.venueId) || recordKeys.has(key) ||
      !record.slots ||
      TIME_SLOTS.some((slot) => !Object.hasOwn(STATUS_LABELS, record.slots[slot]))
    ) {
      throw new Error("空き状況のデータが正しくありません。");
    }
    recordKeys.add(key);
  }
}

function dateClass(date) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  if (weekday === 0 || data.holidays.includes(date)) return "day-holiday";
  if (weekday === 6) return "day-saturday";
  return "";
}

function createRow(name, record, date) {
  const row = document.createElement("tr");
  const heading = document.createElement("th");
  heading.scope = "row";
  heading.textContent = name;
  if (date) heading.className = dateClass(date);
  row.append(heading);

  for (const slot of TIME_SLOTS) {
    const cell = document.createElement("td");
    const status = record?.slots?.[slot];
    cell.textContent = STATUS_LABELS[status] || "不明";
    cell.className = status || "unknown";
    row.append(cell);
  }
  return row;
}

function renderMonth() {
  const month = $("month").value;
  const venueId = $("venue").value;
  const body = $("monthBody");
  body.replaceChildren();
  if (!month || month < displayStart.slice(0, 7) || month > displayEnd.slice(0, 7)) {
    $("monthTitle").textContent = "月を選択してください";
    return;
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const venue = data.venues.find((item) => item.id === venueId);
  $("monthTitle").textContent = `${venue.name}　${year}年${monthNumber}月`;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = WEEKDAYS[new Date(year, monthNumber - 1, day).getDay()];
    const record = recordsByDateAndVenue.get(`${date}|${venueId}`);
    body.append(createRow(`${day}日（${weekday}）`, record, date));
  }
}

function renderDate() {
  const date = $("date").value;
  const body = $("dateBody");
  body.replaceChildren();
  if (!isValidDate(date) || date < displayStart || date > displayEnd) {
    $("dateTitle").textContent = "日付を選択してください";
    $("dateTitle").className = "";
    return;
  }

  const [year, month, day] = date.split("-").map(Number);
  $("dateTitle").textContent = `${year}年${month}月${day}日の空き状況`;
  $("dateTitle").className = dateClass(date);
  for (const venue of data.venues) {
    const record = recordsByDateAndVenue.get(`${date}|${venue.id}`);
    body.append(createRow(venue.name, record));
  }
}

function selectView(showMonthly) {
  $("monthly").hidden = !showMonthly;
  $("daily").hidden = showMonthly;
  $("monthlyTab").setAttribute("aria-pressed", showMonthly);
  $("dailyTab").setAttribute("aria-pressed", !showMonthly);
}

// 日本時間の当月から6か月と、JSONの収録期間が重なる範囲を表示する。
function setDisplayPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  const year = Number(part("year"));
  const month = Number(part("month"));
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const first = `${part("year")}-${part("month")}-01`;
  const last = new Date(Date.UTC(year, month + 5, 0)).toISOString().slice(0, 10);

  displayStart = data.period.start > first ? data.period.start : first;
  displayEnd = data.period.end < last ? data.period.end : last;
  if (displayStart > displayEnd) throw new Error("表示できる期間がありません。");

  const initial = today >= displayStart && today <= displayEnd ? today : displayStart;
  $("month").min = displayStart.slice(0, 7);
  $("month").max = displayEnd.slice(0, 7);
  $("month").value = initial.slice(0, 7);
  $("date").min = displayStart;
  $("date").max = displayEnd;
  $("date").value = initial;
}

async function loadAvailability() {
  try {
    const response = await fetch("availability.json", { cache: "no-store" });
    if (!response.ok) throw new Error("公開データを取得できませんでした。");
    const result = await response.json();
    validateData(result);
    data = result;
    recordsByDateAndVenue = new Map(
      data.records.map((record) => [`${record.date}|${record.venueId}`, record])
    );

    for (const venue of data.venues) {
      const option = document.createElement("option");
      option.value = venue.id;
      option.textContent = venue.name;
      $("venue").append(option);
    }
    setDisplayPeriod();
    const updated = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(data.updatedAt));
    $("updated").textContent = `最終更新：${updated}（日本時間） ／ 掲載期間：${displayStart}〜${displayEnd}`;
    renderMonth();
    renderDate();
    $("content").hidden = false;
  } catch (error) {
    $("updated").textContent = "更新日時を取得できませんでした。";
    $("error").textContent = "空き状況を取得できませんでした。時間をおいて再度お試しいただくか、施設へお問い合わせください。";
    $("error").hidden = false;
  }
}

$("monthlyTab").onclick = () => selectView(true);
$("dailyTab").onclick = () => selectView(false);
$("month").onchange = renderMonth;
$("venue").onchange = renderMonth;
$("date").onchange = renderDate;
loadAvailability();
