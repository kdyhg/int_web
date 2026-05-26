const sitesApiUrl = "/api/sites";

const storageKeys = {
  favorites: "intweb:favorites",
  recent: "intweb:recent",
  writeToken: "intweb:writeToken",
};

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
    imageUrl: "",
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
    imageUrl: "",
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
    imageUrl: "",
    memo: "실험용 링크는 공개 범위를 다시 확인합니다.",
  },
];

const state = {
  sites: [],
  query: "",
  category: "all",
  view: "all",
  editingId: null,
  favorites: new Set(readJson(storageKeys.favorites, [])),
  recent: readJson(storageKeys.recent, []),
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
  storageLabel: document.querySelector("#storageLabel"),
  syncStatus: document.querySelector("#syncStatus"),
  focusSearchButton: document.querySelector("#focusSearchButton"),
  mobileFocusSearchButton: document.querySelector("#mobileFocusSearchButton"),
  openCreateButton: document.querySelector("#openCreateButton"),
  openCreateTopButton: document.querySelector("#openCreateTopButton"),
  mobileCreateButton: document.querySelector("#mobileCreateButton"),
  emptyCreateButton: document.querySelector("#emptyCreateButton"),
  exportButton: document.querySelector("#exportButton"),
  importFile: document.querySelector("#importFile"),
  resetButton: document.querySelector("#resetButton"),
  dialog: document.querySelector("#siteDialog"),
  form: document.querySelector("#siteForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelDialogButton: document.querySelector("#cancelDialogButton"),
  deleteFromDialogButton: document.querySelector("#deleteFromDialogButton"),
};

const categoryLabels = {
  all: "전체",
  production: "운영",
  content: "콘텐츠",
  lab: "실험실",
  admin: "관리",
  docs: "문서",
};

async function loadSites(options = {}) {
  setSyncStatus("API에서 Google Sheets 목록을 불러오는 중...");

  try {
    const data = await apiRequest("GET");
    state.sites = normalizeSiteList(data.sites || []);
    setSyncStatus("Google Sheets API와 동기화됨");
  } catch (error) {
    state.sites = normalizeSiteList(await loadDefaultSites());
    setSyncStatus(`API 연결 실패: ${error.message}`, true);
  }

  cleanStoredReferences();
  renderCategories();
  render();

  if (!options.silent) {
    updateStorageLabel();
  }
}

async function loadDefaultSites() {
  try {
    const response = await fetch("data/sites.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("sites.json을 불러오지 못했습니다.");
    }

    const data = await response.json();
    return Array.isArray(data.sites) ? data.sites : fallbackSites;
  } catch (error) {
    console.info("Fallback site data loaded:", error.message);
    return fallbackSites;
  }
}

async function apiRequest(method, payload, options = {}) {
  const requestOptions = {
    method,
    headers: {},
  };

  if (payload) {
    requestOptions.headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(payload);
  }

  if (method !== "GET") {
    const token = getWriteToken();
    if (token) {
      requestOptions.headers["x-int-web-token"] = token;
    }
  }

  const response = await fetch(sitesApiUrl, requestOptions);

  if (response.status === 401 && method !== "GET" && options.retryAuth !== false) {
    const token = window.prompt("사이트 목록을 수정하려면 관리 토큰을 입력하세요.");
    if (token) {
      setWriteToken(token);
      return apiRequest(method, payload, { retryAuth: false });
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `API 요청 실패 (${response.status})`);
  }

  return data;
}

function getWriteToken() {
  try {
    return window.sessionStorage.getItem(storageKeys.writeToken) || "";
  } catch {
    return "";
  }
}

function setWriteToken(token) {
  try {
    window.sessionStorage.setItem(storageKeys.writeToken, token);
  } catch {
    return;
  }
}

function readJson(key, fallback) {
  try {
    const storage = getStorage();
    if (!storage) return fallback;

    const rawValue = storage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(key, JSON.stringify(value));
}

function normalizeSiteList(sites) {
  const usedIds = new Set();

  return sites.map((site, index) => {
    const normalized = normalizeSite(site);
    const baseId = normalized.id || createSlug(normalized.name || `site-${index + 1}`);
    normalized.id = makeUniqueId(baseId, usedIds);
    usedIds.add(normalized.id);
    return normalized;
  });
}

function normalizeSite(site) {
  return {
    id: typeof site.id === "string" ? site.id.trim() : "",
    name: typeof site.name === "string" ? site.name.trim() : "Untitled Site",
    description: typeof site.description === "string" ? site.description.trim() : "",
    category: typeof site.category === "string" && site.category.trim() ? site.category.trim() : "production",
    tags: normalizeTags(site.tags),
    url: typeof site.url === "string" ? site.url.trim() : "",
    adminUrl: typeof site.adminUrl === "string" ? site.adminUrl.trim() : "",
    repoUrl: typeof site.repoUrl === "string" ? site.repoUrl.trim() : "",
    docsUrl: typeof site.docsUrl === "string" ? site.docsUrl.trim() : "",
    healthUrl: typeof site.healthUrl === "string" ? site.healthUrl.trim() : "",
    imageUrl: typeof site.imageUrl === "string" ? site.imageUrl.trim() : "",
    memo: typeof site.memo === "string" ? site.memo.trim() : "",
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean);
  }

  return [];
}

function createSlug(value) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `site-${Date.now()}`;
}

function makeUniqueId(baseId, usedIds, currentId = "") {
  let candidate = baseId || `site-${Date.now()}`;
  let counter = 2;

  while (usedIds.has(candidate) && candidate !== currentId) {
    candidate = `${baseId}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function saveFavorites() {
  writeJson(storageKeys.favorites, [...state.favorites]);
}

function saveRecent() {
  writeJson(storageKeys.recent, state.recent);
}

function cleanStoredReferences() {
  const siteIds = new Set(state.sites.map((site) => site.id));
  state.favorites = new Set([...state.favorites].filter((id) => siteIds.has(id)));
  state.recent = state.recent.filter((id) => siteIds.has(id));
  saveFavorites();
  saveRecent();
}

function renderCategories() {
  const categories = ["all", ...new Set(state.sites.map((site) => site.category).filter(Boolean))];
  if (state.category !== "all" && !categories.includes(state.category)) {
    state.category = "all";
  }

  elements.categoryFilters.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = "filter-chip";
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
  updateStorageLabel();

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
  const image = card.querySelector(".site-image");
  const fallback = card.querySelector(".visual-fallback");
  const initial = card.querySelector(".visual-initial");
  const visualCategory = card.querySelector(".visual-category");

  card.querySelector(".category-pill").textContent = categoryLabels[site.category] || site.category;
  card.querySelector("h3").textContent = site.name;
  card.querySelector(".description").textContent = site.description || "설명이 없습니다.";
  card.querySelector(".memo").textContent = site.memo || "메모 없음";
  card.querySelector(".visit-count").textContent = state.recent.includes(site.id) ? "recent" : "";

  initial.textContent = getInitials(site.name);
  visualCategory.textContent = site.category;

  if (site.imageUrl) {
    image.src = site.imageUrl;
    image.alt = `${site.name} 카드 이미지`;
    image.hidden = false;
    fallback.hidden = true;
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
    });
  } else {
    image.hidden = true;
    fallback.hidden = false;
  }

  favoriteButton.textContent = state.favorites.has(site.id) ? "★" : "☆";
  favoriteButton.classList.toggle("active", state.favorites.has(site.id));
  favoriteButton.addEventListener("click", () => toggleFavorite(site.id));

  const tagList = card.querySelector(".tag-list");
  (site.tags || []).slice(0, 5).forEach((tag) => {
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
    const healthButton = createActionButton("상태", () => checkHealth(site.healthUrl, statusRow, statusText));
    actions.append(healthButton);
  }

  actions.append(createActionButton("수정", () => openEditor(site)));
  actions.append(createActionButton("삭제", () => deleteSite(site.id), "danger-link"));

  return card;
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function getLinks(site) {
  return [
    { label: "열기", url: site.url, primary: true },
    { label: "관리자", url: site.adminUrl },
    { label: "GitHub", url: site.repoUrl },
    { label: "문서", url: site.docsUrl },
  ].filter((link) => link.url);
}

function createActionButton(label, onClick, extraClass = "") {
  const button = document.createElement("button");
  button.className = `link-button ${extraClass}`.trim();
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function toggleFavorite(siteId) {
  if (state.favorites.has(siteId)) {
    state.favorites.delete(siteId);
  } else {
    state.favorites.add(siteId);
  }

  saveFavorites();
  render();
}

function markRecent(siteId) {
  state.recent = [siteId, ...state.recent.filter((id) => id !== siteId)].slice(0, 8);
  saveRecent();
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
  } catch {
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

function openEditor(site = null) {
  state.editingId = site ? site.id : null;
  elements.dialogTitle.textContent = site ? "사이트 수정" : "사이트 추가";
  elements.form.reset();

  const values = site || {
    id: "",
    name: "",
    url: "",
    category: "",
    tags: [],
    description: "",
    imageUrl: "",
    adminUrl: "",
    repoUrl: "",
    docsUrl: "",
    healthUrl: "",
    memo: "",
  };

  setField("siteId", values.id);
  setField("siteName", values.name);
  setField("siteUrl", values.url);
  setField("siteCategory", values.category);
  setField("siteTags", (values.tags || []).join(", "));
  setField("siteDescription", values.description);
  setField("siteImageUrl", values.imageUrl);
  setField("siteAdminUrl", values.adminUrl);
  setField("siteRepoUrl", values.repoUrl);
  setField("siteDocsUrl", values.docsUrl);
  setField("siteHealthUrl", values.healthUrl);
  setField("siteMemo", values.memo);
  elements.deleteFromDialogButton.hidden = !site;

  if (typeof elements.dialog.showModal === "function") {
    elements.dialog.showModal();
  } else {
    elements.dialog.setAttribute("open", "");
  }

  document.querySelector("#siteName").focus();
}

function setField(id, value) {
  document.querySelector(`#${id}`).value = value || "";
}

function closeEditor() {
  elements.dialog.close();
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.form);
  const rawSite = Object.fromEntries(formData.entries());
  rawSite.tags = normalizeTags(rawSite.tags);

  const site = normalizeSite(rawSite);
  const usedIds = new Set(state.sites.map((item) => item.id));
  const existing = state.sites.find((item) => item.id === state.editingId);
  const baseId = existing ? existing.id : createSlug(site.name);
  site.id = makeUniqueId(baseId, usedIds, existing ? existing.id : "");

  setSyncStatus("API를 통해 Google Sheets에 저장 중...");

  try {
    await apiRequest(existing ? "PUT" : "POST", { site });

    if (existing) {
      state.sites = state.sites.map((item) => (item.id === existing.id ? site : item));
    } else {
      state.sites = [site, ...state.sites];
    }

    renderCategories();
    render();
    closeEditor();
    setSyncStatus("저장 완료. Google Sheets와 동기화했습니다.");
    scheduleSheetRefresh();
  } catch (error) {
    setSyncStatus(error.message, true);
    window.alert(error.message);
  }
}

async function deleteSite(siteId) {
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) return;

  const confirmed = window.confirm(`"${site.name}" 사이트를 삭제할까요?`);
  if (!confirmed) return;

  setSyncStatus("API를 통해 Google Sheets에서 삭제 중...");

  try {
    await apiRequest("DELETE", { id: siteId });
    state.sites = state.sites.filter((item) => item.id !== siteId);
    state.favorites.delete(siteId);
    state.recent = state.recent.filter((id) => id !== siteId);
    saveFavorites();
    saveRecent();

    if (state.editingId === siteId && elements.dialog.open) {
      closeEditor();
    }

    renderCategories();
    render();
    setSyncStatus("삭제 완료. Google Sheets와 동기화했습니다.");
    scheduleSheetRefresh();
  } catch (error) {
    setSyncStatus(error.message, true);
    window.alert(error.message);
  }
}

function exportSites() {
  const payload = JSON.stringify({ sites: state.sites }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "int-web-sites.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importSites(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const rawText = await file.text();
    const parsed = JSON.parse(rawText);
    const importedSites = Array.isArray(parsed) ? parsed : parsed.sites;

    if (!Array.isArray(importedSites)) {
      throw new Error("sites 배열이 없습니다.");
    }

    const sites = normalizeSiteList(importedSites);
    await apiRequest("POST", { action: "replaceAll", sites });
    state.sites = sites;
    cleanStoredReferences();
    renderCategories();
    render();
    setSyncStatus("JSON 목록을 Google Sheets로 교체했습니다.");
    scheduleSheetRefresh();
  } catch (error) {
    setSyncStatus(`가져오기에 실패했습니다: ${error.message}`, true);
    window.alert(`가져오기에 실패했습니다: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

async function refreshSitesFromSheet() {
  await loadSites({ silent: true });
}

function scheduleSheetRefresh() {
  window.setTimeout(() => {
    loadSites({ silent: true });
  }, 1200);
}

function setSyncStatus(message, isError = false) {
  if (!elements.syncStatus) return;
  elements.syncStatus.textContent = message;
  elements.syncStatus.classList.toggle("error", isError);
}

function updateStorageLabel() {
  if (!elements.storageLabel) return;
  elements.storageLabel.textContent = "API";
}

function focusSearch() {
  elements.search.focus();
  elements.search.scrollIntoView({ behavior: "smooth", block: "center" });
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

elements.focusSearchButton.addEventListener("click", focusSearch);
elements.mobileFocusSearchButton.addEventListener("click", focusSearch);
elements.openCreateButton.addEventListener("click", () => openEditor());
elements.openCreateTopButton.addEventListener("click", () => openEditor());
elements.mobileCreateButton.addEventListener("click", () => openEditor());
elements.emptyCreateButton.addEventListener("click", () => openEditor());
elements.exportButton.addEventListener("click", exportSites);
elements.importFile.addEventListener("change", importSites);
elements.resetButton.addEventListener("click", refreshSitesFromSheet);
elements.form.addEventListener("submit", handleFormSubmit);
elements.closeDialogButton.addEventListener("click", closeEditor);
elements.cancelDialogButton.addEventListener("click", closeEditor);
elements.deleteFromDialogButton.addEventListener("click", () => deleteSite(state.editingId));

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
