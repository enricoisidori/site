import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const directory = new URL(".", import.meta.url).pathname;
const archiveColumns = ["id", "name", "entityType", "field", "period", "based", "country", "tags", "priority", "instagram", "website", "notes", "source", "status"];
const columns = ["name", "starred", "entityType", "field", "based", "tags", "instagram", "website", "hidden"];
const headers = ["name", "favourite", "type", "field", "based", "tags", "instagram", "website", "hide"];
const bool = value => value === true || String(value).trim().toLowerCase() === "true";

const dataSource = await fs.readFile(`${directory}archive-data.js`, "utf8");
const archiveRows = Function(`return ${dataSource.replace(/^window\.REALITIES_DATA\s*=\s*/, "").replace(/;\s*$/, "")}`)();
const overridesPath = `${directory}archive-overrides.json`;
const overrides = JSON.parse(await fs.readFile(overridesPath, "utf8"));
const base = archiveRows.map(row => Object.fromEntries(archiveColumns.map((key, index) => [key, row[index] || ""])));
const records = base.filter(record => !overrides[record.id]?.deleted).map(record => ({ ...record, ...(overrides[record.id] || {}) }));
for (const record of Object.values(overrides)) if (record.isNew && !record.deleted) records.push(record);
records.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(`${directory}realities.xlsx`));
const sheet = workbook.worksheets.getItem("Realities");
const values = (await sheet.getUsedRange(true).values).filter(row => row.some(value => value !== null && value !== ""));
if (JSON.stringify(values[0]) !== JSON.stringify(headers)) throw new Error("The Excel headers do not match the Realities site fields.");
const rows = values.slice(1);
if (rows.length !== records.length) throw new Error("Do not add, delete, filter, or reorder Excel rows before importing.");

for (const [index, row] of rows.entries()) {
  const current = records[index];
  const valuesByKey = Object.fromEntries(columns.map((key, columnIndex) => [key, row[columnIndex] ?? ""]));
  overrides[current.id] = { ...current, ...valuesByKey, starred: bool(valuesByKey.starred), hidden: bool(valuesByKey.hidden), isNew: !base.some(record => record.id === current.id) };
}
await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
console.log(`Imported ${rows.length} records from realities.xlsx`);
