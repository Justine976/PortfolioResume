document.documentElement.classList.add("js");

const ageTarget = document.querySelector("[data-age]");
const projectsRoot = document.querySelector("[data-github-projects]");
const projectStatus = document.querySelector("[data-project-status]");
const visitorWidget = document.querySelector("[data-visitor-widget]");
const visitorToggle = visitorWidget?.querySelector(".visitor-toggle");
const visitorCount = document.querySelector("[data-visitor-count]");
const visitorHistory = document.querySelector("[data-visitor-history]");
const visitorHistoryList = document.querySelector(
  "[data-visitor-history-list]",
);
const VISITOR_STORAGE_KEY = "justinePortfolioVisitorStats";
const VISITOR_SESSION_KEY = "justinePortfolioActiveVisit";
const VISITOR_API_URL =
  "https://portfolio-visitor-counter.visitorcountapi.workers.dev";
const MAX_VISITOR_HISTORY = 10;

function calculateAge(birthdate) {
  const today = new Date();
  const birthday = new Date(`${birthdate}T00:00:00`);
  let age = today.getFullYear() - birthday.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() &&
      today.getDate() >= birthday.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function renderAge() {
  if (!ageTarget) return;

  const birthdate = ageTarget.dataset.birthdate;
  ageTarget.textContent = `${calculateAge(birthdate)}`;
}

function readVisitorStats() {
  try {
    const savedStats = JSON.parse(localStorage.getItem(VISITOR_STORAGE_KEY));
    if (!savedStats || typeof savedStats !== "object") {
      return { total: 0, history: [] };
    }

    return {
      total: Number.isFinite(savedStats.total) ? savedStats.total : 0,
      history: Array.isArray(savedStats.history) ? savedStats.history : [],
    };
  } catch {
    return { total: 0, history: [] };
  }
}

function saveVisitorStats(stats) {
  try {
    localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // The counter still works for this page load when browser storage is unavailable.
  }
}

function readActiveVisitId() {
  try {
    const sessionVisitId = sessionStorage.getItem(VISITOR_SESSION_KEY);
    if (sessionVisitId) return sessionVisitId;
  } catch {
    // Some browsers block sessionStorage in strict privacy modes.
  }

  try {
    return localStorage.getItem(VISITOR_SESSION_KEY);
  } catch {
    return null;
  }
}

function saveActiveVisitId(visitId) {
  try {
    sessionStorage.setItem(VISITOR_SESSION_KEY, visitId);
    return;
  } catch {
    // Fall back to localStorage when sessionStorage is unavailable.
  }

  try {
    localStorage.setItem(VISITOR_SESSION_KEY, visitId);
  } catch {
    // Keep the page usable even when browser storage is unavailable.
  }
}

function createVisitId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateActiveVisitId() {
  const activeVisitId = readActiveVisitId();
  if (activeVisitId) return activeVisitId;

  const visitId = createVisitId();
  saveActiveVisitId(visitId);
  return visitId;
}

function formatVisitTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getBrowserName() {
  const userAgent = navigator.userAgent || "";

  if (/Edg\//.test(userAgent)) return "Edge";
  if (/OPR\//.test(userAgent)) return "Opera";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent)) return "Safari";

  return "Browser";
}

function getOperatingSystem() {
  const userAgent = navigator.userAgent || "";
  const platform =
    navigator.userAgentData?.platform || navigator.platform || "";

  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Win/i.test(platform) || /Windows/i.test(userAgent)) return "Windows";
  if (/Mac/i.test(platform) || /Mac OS/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(platform) || /Linux/i.test(userAgent)) return "Linux";

  return "Unknown OS";
}

function getDeviceType() {
  const userAgent = navigator.userAgent || "";
  const isTouchMac =
    /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  const isTablet = /iPad|Tablet/i.test(userAgent) || isTouchMac;
  const isMobile = /Mobi|Android|iPhone|iPod/i.test(userAgent);

  if (isTablet) return "Tablet";
  if (isMobile) return "Mobile";

  return "Desktop";
}

function getCurrentDeviceInfo() {
  return {
    type: getDeviceType(),
    browser: getBrowserName(),
    os: getOperatingSystem(),
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language || "Unknown language",
  };
}

function formatDeviceInfo(device) {
  if (!device) return "Unknown device";

  return `${device.type} - ${device.browser} on ${device.os} - ${device.screen}`;
}

function closeVisitorHistory() {
  if (!visitorToggle || !visitorHistory) return;

  visitorToggle.setAttribute("aria-expanded", "false");
  visitorHistory.hidden = true;
}

function renderVisitorStats(stats) {
  if (!visitorCount || !visitorHistoryList) return;

  const total = Number.isFinite(stats.total) ? stats.total : 0;
  const history = Array.isArray(stats.history) ? stats.history : [];

  visitorCount.textContent = String(total).padStart(3, "0");
  visitorHistoryList.replaceChildren(
    ...history.map((visit) => {
      const item = document.createElement("li");
      const visitTime = document.createElement("span");
      const deviceInfo = document.createElement("span");
      const views = Number.isFinite(visit.views) ? visit.views : 1;
      const viewText = `${views} ${views === 1 ? "view" : "views"}`;
      const countryText = visit.country ? ` - ${visit.country}` : "";

      visitTime.className = "visitor-visit-time";
      visitTime.textContent = `Visit ${String(visit.count).padStart(3, "0")} - ${formatVisitTimestamp(visit.timestamp)}`;

      deviceInfo.className = "visitor-device";
      deviceInfo.textContent = `${formatDeviceInfo(visit.device)}${countryText} - ${viewText}`;

      item.append(visitTime, deviceInfo);
      return item;
    }),
  );
}

function getVisitorApiUrl(path) {
  const apiUrl = VISITOR_API_URL.trim().replace(/\/$/, "");
  return apiUrl ? `${apiUrl}${path}` : "";
}

async function recordSharedVisitor() {
  const response = await fetch(getVisitorApiUrl("/visit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitorId: getOrCreateActiveVisitId(),
      device: getCurrentDeviceInfo(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Visitor API error ${response.status}`);
  }

  renderVisitorStats(await response.json());
}

function recordLocalVisitor() {
  const stats = readVisitorStats();
  const activeVisitId = readActiveVisitId();
  const existingVisit = stats.history.find(
    (visit) => visit.id === activeVisitId,
  );
  const now = Date.now();
  let nextStats;

  if (existingVisit) {
    nextStats = {
      total: stats.total,
      history: stats.history.map((visit) => {
        if (visit.id !== activeVisitId) return visit;

        return {
          ...visit,
          lastSeen: now,
          views: (Number.isFinite(visit.views) ? visit.views : 1) + 1,
        };
      }),
    };
  } else {
    const visitId = getOrCreateActiveVisitId();
    const nextTotal = stats.total + 1;

    nextStats = {
      total: nextTotal,
      history: [
        {
          id: visitId,
          count: nextTotal,
          timestamp: now,
          lastSeen: now,
          views: 1,
          device: getCurrentDeviceInfo(),
        },
        ...stats.history,
      ].slice(0, MAX_VISITOR_HISTORY),
    };
  }

  saveVisitorStats(nextStats);
  renderVisitorStats(nextStats);
}

function recordVisitor() {
  if (!visitorWidget || !visitorToggle || !visitorHistory) return;

  visitorToggle.addEventListener("click", () => {
    const isExpanded = visitorToggle.getAttribute("aria-expanded") === "true";
    visitorToggle.setAttribute("aria-expanded", String(!isExpanded));
    visitorHistory.hidden = isExpanded;
  });

  document.addEventListener("click", (event) => {
    if (!visitorWidget.contains(event.target)) {
      closeVisitorHistory();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeVisitorHistory();
    }
  });

  if (getVisitorApiUrl("/visit")) {
    recordSharedVisitor().catch((error) => {
      console.warn(
        "Shared visitor counter is unavailable. Using local counter.",
        error,
      );
      recordLocalVisitor();
    });
    return;
  }

  recordLocalVisitor();
}

async function fetchGithubRepos(username) {
  const repos = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = `https://api.github.com/users/${username}/repos?sort=updated&per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub API error ${response.status}: ${body}`);
    }

    const pageRepos = await response.json();
    repos.push(...pageRepos);
    hasNextPage = response.headers.get("Link")?.includes('rel="next"') ?? false;
    page += 1;
  }

  return repos;
}

function formatRepoDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function makePill(text) {
  const pill = document.createElement("span");
  pill.className = "pill";
  pill.textContent = text;
  return pill;
}

function toTitleCase(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchRepoLanguages(languagesUrl) {
  try {
    const response = await fetch(languagesUrl, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return [];
    const languages = await response.json();
    return Object.keys(languages);
  } catch {
    return [];
  }
}

function generateRepoDescription(repo, languages) {
  if (repo.description) return repo.description;

  const projectName = toTitleCase(repo.name);
  const primaryLanguage = repo.language || "programming";
  const allLanguages =
    languages.length > 0 ? languages.join(", ") : primaryLanguage;
  const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];
  const topicText = topics.length ? ` Includes ${topics.join(", ")}.` : "";

  return `${projectName} uses ${allLanguages}. From my GitHub portfolio.${topicText}`;
}

async function renderRepo(repo) {
  const card = document.createElement("article");
  card.className = "item project-card";

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `Updated ${formatRepoDate(repo.updated_at)}`;

  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = repo.html_url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = repo.name;
  title.append(link);

  // Avoid making an extra network request per repo for languages (causes rate limiting)
  // Use the single `repo.language` value returned by the repo list endpoint instead.
  const languages = repo.language ? [repo.language] : [];
  const description = document.createElement("p");
  description.textContent = generateRepoDescription(repo, languages);

  const pills = document.createElement("div");
  pills.className = "pill-row";
  pills.append(makePill(repo.language || "Code"));
  pills.append(makePill(`${repo.stargazers_count} stars`));
  pills.append(makePill(`${repo.forks_count} forks`));

  if (repo.homepage) {
    const demo = document.createElement("a");
    demo.className = "pill project-link";
    demo.href = repo.homepage;
    demo.target = "_blank";
    demo.rel = "noopener";
    demo.textContent = "Live demo";
    pills.append(demo);
  }

  card.append(meta, title, description, pills);
  return card;
}

async function loadGithubProjects() {
  if (!projectsRoot || !projectStatus) return;

  const username = projectsRoot.dataset.username;

  try {
    const visibleRepos = await fetchGithubRepos(username);

    const renderedRepos = await Promise.all(visibleRepos.map(renderRepo));
    projectsRoot.replaceChildren(...renderedRepos);
    projectStatus.textContent = `${visibleRepos.length} public repositories loaded from GitHub.`;

    if (visibleRepos.length === 0) {
      projectStatus.textContent = "No public GitHub repositories found.";
    }
  } catch (error) {
    console.error("Error loading GitHub projects:", error);
    projectStatus.textContent = "GitHub projects are unavailable right now.";
  }
}

renderAge();
recordVisitor();
loadGithubProjects();
