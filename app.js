const storeKey = "habitflow:v2";

const initialState = {
  habits: [
    {
      id: crypto.randomUUID(),
      name: "Walk for 20 minutes",
      days: "daily",
      time: "08:00",
      notify: true,
      completions: {},
    },
    {
      id: crypto.randomUUID(),
      name: "Read 10 pages",
      days: "weekdays",
      time: "21:00",
      notify: false,
      completions: {},
    },
  ],
  settings: {
    globalNotify: false,
    googleClientId: "",
    calendarSync: false,
  },
};

let state = loadState();
let notificationTimer = null;

const views = document.querySelectorAll(".view");
const tabs = document.querySelectorAll(".tab");
const todayList = document.querySelector("#todayList");
const habitList = document.querySelector("#habitList");
const todayRate = document.querySelector("#todayRate");
const todayMeter = document.querySelector("#todayMeter");
const dateLabel = document.querySelector("#dateLabel");
const emptyTemplate = document.querySelector("#emptyTemplate");

function loadState() {
  const saved = localStorage.getItem(storeKey);
  if (!saved) return initialState;
  try {
    return { ...initialState, ...JSON.parse(saved) };
  } catch {
    return initialState;
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate() {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function isScheduledToday(habit) {
  const day = new Date().getDay();
  if (habit.days === "daily") return true;
  if (habit.days === "weekdays") return day >= 1 && day <= 5;
  if (habit.days === "weekends") return day === 0 || day === 6;
  return true;
}

function daysLabel(days) {
  return { daily: "Daily", weekdays: "Weekdays", weekends: "Weekends" }[days] || "Daily";
}

function render() {
  dateLabel.textContent = formatDate();
  renderToday();
  renderHabits();
  renderSettings();
  scheduleNotifications();
}

function renderToday() {
  const habits = state.habits.filter(isScheduledToday);
  const doneCount = habits.filter((habit) => habit.completions[todayKey()]).length;
  const rate = habits.length ? Math.round((doneCount / habits.length) * 100) : 0;

  todayRate.textContent = `${rate}%`;
  todayMeter.style.width = `${rate}%`;
  todayList.innerHTML = "";

  if (!habits.length) {
    todayList.append(emptyTemplate.content.cloneNode(true));
    return;
  }

  habits.forEach((habit) => todayList.append(createHabitCard(habit, true)));
}

function renderHabits() {
  habitList.innerHTML = "";
  if (!state.habits.length) {
    habitList.append(emptyTemplate.content.cloneNode(true));
    return;
  }
  state.habits.forEach((habit) => habitList.append(createHabitCard(habit, false)));
}

function renderSettings() {
  document.querySelector("#globalNotify").checked = state.settings.globalNotify;
  document.querySelector("#googleClientId").value = state.settings.googleClientId;
  document.querySelector("#calendarSync").checked = state.settings.calendarSync;
  document.querySelector("#permissionStatus").textContent =
    "Notification" in window ? Notification.permission : "Unsupported";
}

function createHabitCard(habit, checkMode) {
  const card = document.createElement("article");
  card.className = "habit-card";

  const main = document.createElement("div");
  main.className = "habit-main";
  main.innerHTML = `
    <div class="habit-title">${escapeHtml(habit.name)}</div>
    <div class="habit-meta">${daysLabel(habit.days)} / ${habit.time} / reminder ${habit.notify ? "on" : "off"}</div>
  `;

  const actions = document.createElement("div");
  actions.className = "habit-actions";

  if (checkMode) {
    const done = Boolean(habit.completions[todayKey()]);
    const check = document.createElement("button");
    check.className = `check ${done ? "done" : ""}`;
    check.textContent = done ? "OK" : "";
    check.ariaLabel = `Mark ${habit.name} as ${done ? "not done" : "done"}`;
    check.addEventListener("click", () => toggleHabit(habit.id));
    actions.append(check);
  } else {
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => removeHabit(habit.id));
    actions.append(remove);
  }

  card.append(main, actions);
  return card;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

function toggleHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  habit.completions[todayKey()] = !habit.completions[todayKey()];
  saveState();
  render();
}

function removeHabit(id) {
  state.habits = state.habits.filter((habit) => habit.id !== id);
  saveState();
  render();
}

function addHabit(event) {
  event.preventDefault();
  const nameInput = document.querySelector("#habitName");
  const name = nameInput.value.trim();
  if (!name) return;

  state.habits.unshift({
    id: crypto.randomUUID(),
    name,
    days: document.querySelector("#habitDays").value,
    time: document.querySelector("#habitTime").value || "08:00",
    notify: document.querySelector("#habitNotify").checked,
    completions: {},
  });

  event.target.reset();
  document.querySelector("#habitTime").value = "08:00";
  document.querySelector("#habitNotify").checked = true;
  saveState();
  render();
  switchView("today");
}

function switchView(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  views.forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    document.querySelector("#syncStatus").textContent = "This browser does not support notifications.";
    return;
  }
  await Notification.requestPermission();
  renderSettings();
}

function scheduleNotifications() {
  clearTimeout(notificationTimer);
  if (!state.settings.globalNotify || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const now = new Date();
  const next = state.habits
    .filter((habit) => habit.notify && isScheduledToday(habit) && !habit.completions[todayKey()])
    .map((habit) => {
      const [hours, minutes] = habit.time.split(":").map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return { habit, date };
    })
    .filter((item) => item.date > now)
    .sort((a, b) => a.date - b.date)[0];

  if (!next) return;

  notificationTimer = setTimeout(() => {
    new Notification("HabitFlow", { body: `Time for ${next.habit.name}` });
    scheduleNotifications();
  }, next.date - now);
}

function saveSyncSettings() {
  state.settings.globalNotify = document.querySelector("#globalNotify").checked;
  state.settings.googleClientId = document.querySelector("#googleClientId").value.trim();
  state.settings.calendarSync = document.querySelector("#calendarSync").checked;
  saveState();
  render();

  const status = state.settings.calendarSync
    ? "Sync settings saved. Add a Google OAuth setup to enable direct API sync."
    : "Settings saved.";
  document.querySelector("#syncStatus").textContent = status;
}

function downloadIcs() {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HabitFlow//HabitFlow Calendar//EN",
  ];

  state.habits.forEach((habit) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${habit.id}@habitflow.local`);
    lines.push(`SUMMARY:${escapeIcs(habit.name)}`);
    lines.push(`DTSTART:${icsDate(habit.time)}`);
    lines.push("DURATION:PT30M");
    lines.push(`RRULE:${rruleFor(habit.days)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "habitflow.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function icsDate(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function rruleFor(days) {
  if (days === "weekdays") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (days === "weekends") return "FREQ=WEEKLY;BYDAY=SA,SU";
  return "FREQ=DAILY";
}

function escapeIcs(value) {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
document.querySelector("#quickAdd").addEventListener("click", () => switchView("habits"));
document.querySelector("#habitForm").addEventListener("submit", addHabit);
document.querySelector("#requestNotification").addEventListener("click", requestNotifications);
document.querySelector("#saveSync").addEventListener("click", saveSyncSettings);
document.querySelector("#downloadIcs").addEventListener("click", downloadIcs);

render();
