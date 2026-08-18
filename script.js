document.documentElement.classList.add("js");

const ageTarget = document.querySelector("[data-age]");
const projectsRoot = document.querySelector("[data-github-projects]");
const projectStatus = document.querySelector("[data-project-status]");

function calculateAge(birthdate) {
  const today = new Date();
  const birthday = new Date(`${birthdate}T00:00:00`);
  let age = today.getFullYear() - birthday.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function renderAge() {
  if (!ageTarget) return;

  const birthdate = ageTarget.dataset.birthdate;
  ageTarget.textContent = `${calculateAge(birthdate)}`;
}

async function fetchGithubRepos(username) {
  const repos = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = `https://api.github.com/users/${username}/repos?sort=updated&per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!response.ok) {
      throw new Error("GitHub repositories could not be loaded.");
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
    year: "numeric"
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
      headers: { Accept: "application/vnd.github+json" }
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
  const allLanguages = languages.length > 0 ? languages.join(", ") : primaryLanguage;
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

  const languages = await fetchRepoLanguages(repo.languages_url);
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
    projectStatus.textContent = "GitHub projects are unavailable right now. Visit github.com/Justine976.";
  }
}

renderAge();
loadGithubProjects();
