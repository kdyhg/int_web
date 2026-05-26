const crypto = require("node:crypto");

const DEFAULT_SPREADSHEET_ID = "1biZUbR5uY654A8WShsdMdzn5Y-bPudODo-GsIYu9YFo";
const DEFAULT_SHEET_GID = "0";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_BASE_URL = "https://sheets.googleapis.com";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const HEADERS = [
  "id",
  "name",
  "description",
  "category",
  "tags",
  "url",
  "adminUrl",
  "repoUrl",
  "docsUrl",
  "healthUrl",
  "imageUrl",
  "memo",
];

let cachedToken = null;
let cachedSheetContext = null;

module.exports = async function handler(request, response) {
  setNoStoreJsonHeaders(response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    if (request.method === "GET") {
      const sites = await listSites();
      sendJson(response, 200, { ok: true, sites });
      return;
    }

    assertWriteAuthorized(request);

    if (request.method === "POST") {
      const body = await readRequestBody(request);

      if (body.action === "replaceAll") {
        await replaceAllSites(normalizeSiteList(body.sites || []));
        sendJson(response, 200, { ok: true });
        return;
      }

      const site = normalizeSite(body.site || body);
      await upsertSite(site);
      sendJson(response, 200, { ok: true, site });
      return;
    }

    if (request.method === "PUT") {
      const body = await readRequestBody(request);
      const site = normalizeSite(body.site || body);
      await upsertSite(site);
      sendJson(response, 200, { ok: true, site });
      return;
    }

    if (request.method === "DELETE") {
      const body = await readRequestBody(request);
      const id = String(body.id || getQueryParam(request.url, "id") || "");
      await deleteSite(id);
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { ok: false, error: error.message });
  }
};

function setNoStoreJsonHeaders(response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.end(JSON.stringify(payload));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertWriteAuthorized(request) {
  const requiredToken = process.env.INT_WEB_WRITE_TOKEN;
  if (!requiredToken) return;

  const headerToken = request.headers["x-int-web-token"];
  const authHeader = request.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const providedToken = headerToken || bearerToken;

  if (providedToken !== requiredToken) {
    throw httpError(401, "관리 토큰이 필요합니다.");
  }
}

async function readRequestBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  const rawBody =
    typeof request.body === "string" || Buffer.isBuffer(request.body)
      ? request.body.toString()
      : await readStream(request);

  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw httpError(400, "JSON 요청 본문이 올바르지 않습니다.");
  }
}

function readStream(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function getQueryParam(rawUrl, key) {
  const url = new URL(rawUrl || "/", "http://localhost");
  return url.searchParams.get(key);
}

async function listSites() {
  const context = await getSheetContext();
  await ensureHeaders(context);

  const data = await googleSheetsRequest(
    `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, "A2:L"))}`,
  );

  return (data.values || []).map(rowToSite).filter((site) => site.name || site.url);
}

async function upsertSite(site) {
  if (!site.id) {
    throw httpError(400, "site.id is required");
  }

  const context = await getSheetContext();
  await ensureHeaders(context);

  const ids = await getIdColumn(context);
  const existingIndex = ids.indexOf(site.id);
  const row = siteToRow(site);

  if (existingIndex === -1) {
    await googleSheetsRequest(
      `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, "A:L"))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: { values: [row] },
      },
    );
    return;
  }

  const rowNumber = existingIndex + 2;
  await googleSheetsRequest(
    `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, `A${rowNumber}:L${rowNumber}`))}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: { values: [row] },
    },
  );
}

async function deleteSite(id) {
  if (!id) {
    throw httpError(400, "id is required");
  }

  const context = await getSheetContext();
  const ids = await getIdColumn(context);
  const existingIndex = ids.indexOf(id);

  if (existingIndex === -1) return;

  const zeroBasedRowIndex = existingIndex + 1;
  await googleSheetsBatchUpdate(context.spreadsheetId, {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: context.sheetId,
            dimension: "ROWS",
            startIndex: zeroBasedRowIndex,
            endIndex: zeroBasedRowIndex + 1,
          },
        },
      },
    ],
  });
}

async function replaceAllSites(sites) {
  const context = await getSheetContext();
  await googleSheetsRequest(
    `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, "A:L"))}:clear`,
    { method: "POST", body: {} },
  );

  const rows = [HEADERS, ...sites.map(siteToRow)];
  await googleSheetsRequest(
    `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, `A1:L${rows.length}`))}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: { values: rows },
    },
  );
}

async function ensureHeaders(context) {
  const data = await googleSheetsRequest(
    `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, "A1:L1"))}`,
  );
  const firstRow = data.values && data.values[0] ? data.values[0] : [];
  const hasAnyHeader = firstRow.some((value) => String(value || "").trim());
  const isCurrent = HEADERS.every((header, index) => firstRow[index] === header);

  if (hasAnyHeader && isCurrent) return;

  await googleSheetsRequest(
    `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, "A1:L1"))}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: { values: [HEADERS] },
    },
  );
}

async function getIdColumn(context) {
  const data = await googleSheetsRequest(
    `/${context.spreadsheetId}/values/${encodeURIComponent(a1Range(context.title, "A2:A"))}`,
  );

  return (data.values || []).map((row) => String(row[0] || ""));
}

function rowToSite(row) {
  const site = {};

  HEADERS.forEach((header, index) => {
    site[header] = row[index] == null ? "" : String(row[index]);
  });

  site.tags = normalizeTags(site.tags);
  return normalizeSite(site);
}

function siteToRow(site) {
  const normalized = normalizeSite(site);
  return HEADERS.map((header) => {
    const value = normalized[header];
    return Array.isArray(value) ? value.join(", ") : value || "";
  });
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

function normalizeSite(site = {}) {
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

async function getSheetContext() {
  if (cachedSheetContext) return cachedSheetContext;

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID || DEFAULT_SPREADSHEET_ID;
  const targetGid = Number(process.env.GOOGLE_SHEET_GID || DEFAULT_SHEET_GID);
  const metadata = await googleApiRequest(
    `${GOOGLE_SHEETS_BASE_URL}/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
  );
  const sheet =
    (metadata.sheets || []).find((item) => item.properties.sheetId === targetGid) ||
    (metadata.sheets || [])[0];

  if (!sheet) {
    throw new Error("Google Sheets 탭을 찾을 수 없습니다.");
  }

  cachedSheetContext = {
    spreadsheetId,
    sheetId: sheet.properties.sheetId,
    title: sheet.properties.title,
  };
  return cachedSheetContext;
}

function a1Range(sheetTitle, range) {
  return `'${String(sheetTitle).replace(/'/g, "''")}'!${range}`;
}

async function googleSheetsRequest(path, options = {}) {
  return googleApiRequest(`${GOOGLE_SHEETS_BASE_URL}/v4/spreadsheets${path}`, options);
}

async function googleSheetsBatchUpdate(spreadsheetId, body) {
  return googleApiRequest(`${GOOGLE_SHEETS_BASE_URL}/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body,
  });
}

async function googleApiRequest(url, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `Google API request failed (${response.status})`);
  }

  return data;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.value;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || "");

  if (!clientEmail || !privateKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL과 GOOGLE_PRIVATE_KEY 환경변수가 필요합니다.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsignedJwt).end().sign(privateKey, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Google access token 발급에 실패했습니다.");
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

function normalizePrivateKey(value) {
  const trimmed = String(value || "").trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed.replace(/\\n/g, "\n");
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}
