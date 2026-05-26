const fallbackSites = [
  {
    id: "portfolio",
    name: "Portfolio",
    description: "개인 포트폴리오와 프로젝트 소개를 모아둔 공개 사이트",
    category: "production",
    tags: ["portfolio", "public", "profile"],
    url: "https://example.com",
    adminUrl: "",
    repoUrl: "https://github.com/kdyhg",
    docsUrl: "",
    healthUrl: "https://example.com",
    memo: "새 프로젝트를 올린 뒤 첫 화면과 모바일 레이아웃을 확인합니다.",
  },
  {
    id: "blog",
    name: "Tech Blog",
    description: "개발 기록과 학습 노트를 정리하는 블로그",
    category: "content",
    tags: ["blog", "writing", "docs"],
    url: "https://example.com/blog",
    adminUrl: "https://example.com/admin",
    repoUrl: "",
    docsUrl: "",
    healthUrl: "https://example.com/blog",
    memo: "글 작성 전 임시 저장 여부와 이미지 경로를 확인합니다.",
  },
  {
    id: "lab",
    name: "Web Lab",
    description: "실험 중인 웹 도구와 테스트 배포를 모아둔 공간",
    category: "lab",
    tags: ["experiment", "tool", "staging"],
    url: "https://example.com/lab",
    adminUrl: "",
    repoUrl: "https://github.com/kdyhg/Int_web",
    docsUrl: "",
    healthUrl: "https://example.com/lab",
    memo: "실험용 링크는 공개 범위를 다시 확인합니다.",
  },
];

const state = {
  sites: [],
  query: "",
  category: "all",
  view: "all",
  favorites: new Set(JSON.parse(localStorage.getItem("intweb:favorites") || "[]")),
  recent: JSON.parse(localStorage.getItem("intweb:recent") || "[]"),
};

const elements = {
  grid: document.querySelector("#siteGrid"),
  template: document.querySelector("#siteCardTemplate"),
  search: document.querySelector("#siteSearch"),
  categoryFilters: document.querySelector("#categoryFilters"),
  emptyState: document.querySelector("#emptyState"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCount: document.querySelector("#resultCount"),
  totalCount: document.querySelector("#totalCount"),
  favoriteCount: document.querySelector("#favoriteCount"),
  recentCount: document.querySelector("#recentCount"),
  syncTime: document.querySelector("#syncTime"),
  focusSearchButton: document.querySelector("#focusSearchButton"),
};

const categoryLabels = {
  all: "전체",
  production: "운영",
  content: "콘텐츠",
  lab: "실험실",
  admin: "관리",
  docs: "문서",
};

async function loadSites() {
  try {
    const response = await fetch("data/sites.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("sites.json을 불러오지 못했습니다.");
    }

    const data = await response.json();
    state.sites = Array.isArray(data.sites) ? data.sites : fallbackSites;
  } catch (error) {
    console.info("Fallback site data loaded:", error.message);
    state.sites = fallbackSites;
  }

  elements.syncTime.textContent = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  renderCategories();
  render();
}

function renderCategories() {
  const categories = ["all", ...new Set(state.sites.map((site) => site.category).filter(Boolean))];
  elements.categoryFilters.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = "filter-button";
    button.type = "button";
    button.dataset.category = category;
    button.textContent = categoryLabels[category] || category;
    button.addEventListener("click", () => {
      state.category = category;
      render();
    });
    elements.categoryFilters.append(button);
  });
}

function render() {
  const sites = getFilteredSites();
  elements.grid.innerHTML = "";

  sites.forEach((site) => {
    elements.grid.append(createSiteCard(site));
  });

  elements.emptyState.classList.toggle("hidden", sites.length > 0);
  elements.resultTitle.textContent = getResultTitle();
  elements.resultCount.textContent = `${sites.length}개`;
  elements.totalCount.textContent = state.sites.length;
  elements.favoriteCount.textContent = state.favorites.size;
  elements.recentCount.textContent = state.recent.length;

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.category);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
}

function getFilteredSites() {
  const query = state.query.trim().toLowerCase();

  return state.sites.filter((site) => {
    const searchable = [
      site.name,
      site.description,
      site.category,
      site.memo,
      ...(site.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !query || searchable.includes(query);
    const matchesCategory = state.category === "all" || site.category === state.category;
    const matchesView =
      state.view === "all" ||
      (state.view === "favorites" && state.favorites.has(site.id)) ||
      (state.view === "recent" && state.recent.includes(site.id));

    return matchesQuery && matchesCategory && matchesView;
  });
}

function createSiteCard(site) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const statusRow = card.querySelector(".status-row");
  const statusText = card.querySelector(".status-text");
  const favoriteButton = card.querySelector(".favorite-button");

  card.querySelector(".category-pill").textContent = categoryLabels[site.category] || site.category;
  card.querySelector("h3").textContent = site.name;
  card.querySelector(".description").textContent = site.description;
  card.querySelector(".memo").textContent = site.memo || "메모가 없습니다.";

  favoriteButton.textContent = state.favorites.has(site.id) ? "★" : "☆";
  favoriteButton.classList.toggle("active", state.favorites.has(site.id));
  favoriteButton.addEventListener("click", () => toggleFavorite(site.id));

  const tagList = card.querySelector(".tag-list");
  (site.tags || []).forEach((tag) => {
    const tagElement = document.createElement("span");
    tagElement.className = "tag";
    tagElement.textContent = `#${tag}`;
    tagList.append(tagElement);
  });

  const actions = card.querySelector(".card-actions");
  getLinks(site).forEach((link) => {
    const anchor = document.createElement("a");
    anchor.className = `link-button ${link.primary ? "primary-link" : ""}`;
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;
    anchor.addEventListener("click", () => markRecent(site.id));
    actions.append(anchor);
  });

  if (site.healthUrl) {
    const healthButton = document.createElement("button");
    healthButton.className = "link-button";
    healthButton.type = "button";
    healthButton.textContent = "상태 점검";
    healthButton.addEventListener("click", () => checkHealth(site.healthUrl, statusRow, statusText));
    actions.append(healthButton);
  }

  return card;
}

function getLinks(site) {
  return [
    { label: "열기", url: site.url, primary: true },
    { label: "관리자", url: site.adminUrl },
    { label: "GitHub", url: site.repoUrl },
    { label: "문서", url: site.docsUrl },
  ].filter((link) => link.url);
}

function toggleFavorite(siteId) {
  if (state.favorites.has(siteId)) {
    state.favorites.delete(siteId);
  } else {
    state.favorites.add(siteId);
  }

  localStorage.setItem("intweb:favorites", JSON.stringify([...state.favorites]));
  render();
}

function markRecent(siteId) {
  state.recent = [siteId, ...state.recent.filter((id) => id !== siteId)].slice(0, 8);
  localStorage.setItem("intweb:recent", JSON.stringify(state.recent));
  render();
}

async function checkHealth(url, row, text) {
  row.className = "status-row checking";
  text.textContent = "확인 중...";

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    row.className = "status-row online";
    text.textContent = "접속 가능";
  } catch (error) {
    row.className = "status-row offline";
    text.textContent = "확인 실패";
  } finally {
    window.clearTimeout(timeout);
  }
}

function getResultTitle() {
  if (state.view === "favorites") return "즐겨찾기";
  if (state.view === "recent") return "최근 방문";
  if (state.category !== "all") return categoryLabels[state.category] || state.category;
  return state.query ? "검색 결과" : "전체 사이트";
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

elements.focusSearchButton.addEventListener("click", () => {
  elements.search.focus();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    render();
  });
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
  }
});

loadSites();
