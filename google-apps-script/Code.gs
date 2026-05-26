const SPREADSHEET_ID = "1biZUbR5uY654A8WShsdMdzn5Y-bPudODo-GsIYu9YFo";
const SHEET_GID = 0;
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

function doGet(event) {
  const action = event.parameter.action || "list";
  const callback = event.parameter.callback;

  try {
    if (action !== "list") {
      throw new Error("Unsupported action: " + action);
    }

    return output({ ok: true, sites: listSites() }, callback);
  } catch (error) {
    return output({ ok: false, error: error.message }, callback);
  }
}

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || "{}");
    const action = body.action;

    if (action === "upsert") {
      upsertSite(body.site);
      return output({ ok: true });
    }

    if (action === "delete") {
      deleteSite(body.id);
      return output({ ok: true });
    }

    if (action === "replaceAll") {
      replaceAllSites(body.sites || []);
      return output({ ok: true });
    }

    throw new Error("Unsupported action: " + action);
  } catch (error) {
    return output({ ok: false, error: error.message });
  }
}

function output(payload, callback) {
  const json = JSON.stringify(payload);
  const content = callback ? callback + "(" + json + ");" : json;
  const mimeType = callback
    ? ContentService.MimeType.JAVASCRIPT
    : ContentService.MimeType.JSON;

  return ContentService.createTextOutput(content).setMimeType(mimeType);
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = spreadsheet.getSheets();
  const sheet =
    sheets.find((item) => item.getSheetId() === SHEET_GID) || sheets[0];

  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.some((value) => String(value || "").trim());

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const normalized = firstRow.map((value) => String(value || "").trim());
  const missingHeaders = HEADERS.filter((header) => !normalized.includes(header));

  if (missingHeaders.length > 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function listSites() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, HEADERS.length)
    .getValues()
    .map(rowToSite)
    .filter((site) => site.name || site.url);
}

function rowToSite(row) {
  const site = {};

  HEADERS.forEach((header, index) => {
    site[header] = row[index] == null ? "" : String(row[index]);
  });

  site.tags = site.tags
    ? site.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];

  return site;
}

function siteToRow(site) {
  return HEADERS.map((header) => {
    const value = site && site[header] != null ? site[header] : "";
    return Array.isArray(value) ? value.join(", ") : value;
  });
}

function upsertSite(site) {
  if (!site || !site.id) {
    throw new Error("site.id is required");
  }

  const sheet = getSheet();
  const ids = getIdColumn(sheet);
  const index = ids.indexOf(site.id);
  const row = siteToRow(site);

  if (index === -1) {
    sheet.appendRow(row);
    return;
  }

  sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues([row]);
}

function deleteSite(id) {
  if (!id) {
    throw new Error("id is required");
  }

  const sheet = getSheet();
  const ids = getIdColumn(sheet);
  const index = ids.indexOf(id);

  if (index !== -1) {
    sheet.deleteRow(index + 2);
  }
}

function replaceAllSites(sites) {
  const sheet = getSheet();
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (!sites.length) {
    return;
  }

  const rows = sites.map(siteToRow);
  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function getIdColumn(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map((row) => String(row[0] || ""));
}
