import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config/index.ts";
import type { Db } from "../../db/client.ts";
import { homeofficeToCsv, reisekostenToCsv } from "../../export/csv.ts";
import { homeofficeToPdf, reisekostenToPdf } from "../../export/pdf.ts";
import { homeofficeToXlsx, reisekostenToXlsx } from "../../export/xlsx.ts";
import { buildHomeofficeRows, buildReisekostenRows } from "../../services/export.ts";

const YearSchema = z.coerce.number().int().min(2020).max(2100);
const FormatSchema = z.enum(["pdf", "xlsx", "csv"]);

const CONTENT_TYPES: Record<"pdf" | "xlsx" | "csv", string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

export interface ExportRouteDeps {
  db: Db;
  config: AppConfig;
}

export function createExportRouter(deps: ExportRouteDeps): Hono {
  const app = new Hono();

  app.get("/reisekosten", async (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    const formatParsed = FormatSchema.safeParse(c.req.query("format"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    if (!formatParsed.success) return c.json({ error: "invalid_format" }, 400);
    const year = yearParsed.data;
    const format = formatParsed.data;
    try {
      const data = buildReisekostenRows(deps.db, year, deps.config);
      let buf: Buffer;
      if (format === "csv") buf = reisekostenToCsv(data);
      else if (format === "xlsx") buf = await reisekostenToXlsx(data);
      else buf = await reisekostenToPdf(data);

      c.header("Content-Type", CONTENT_TYPES[format]);
      c.header("Content-Disposition", `attachment; filename="reisekosten-${year}.${format}"`);
      // Buffer → ArrayBuffer-Slice für Hono's body-Signatur (Uint8Array<ArrayBuffer>)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return c.body(new Uint8Array(ab));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Keine Sätze für")) {
        return c.json({ error: "year_not_configured" }, 400);
      }
      throw err;
    }
  });

  app.get("/homeoffice", async (c) => {
    const yearParsed = YearSchema.safeParse(c.req.query("year"));
    const formatParsed = FormatSchema.safeParse(c.req.query("format"));
    if (!yearParsed.success) return c.json({ error: "invalid_query" }, 400);
    if (!formatParsed.success) return c.json({ error: "invalid_format" }, 400);
    const year = yearParsed.data;
    const format = formatParsed.data;
    try {
      const data = buildHomeofficeRows(deps.db, year, deps.config);
      let buf: Buffer;
      if (format === "csv") buf = homeofficeToCsv(data);
      else if (format === "xlsx") buf = await homeofficeToXlsx(data);
      else buf = await homeofficeToPdf(data);

      c.header("Content-Type", CONTENT_TYPES[format]);
      c.header("Content-Disposition", `attachment; filename="homeoffice-${year}.${format}"`);
      // Buffer → ArrayBuffer-Slice für Hono's body-Signatur (Uint8Array<ArrayBuffer>)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return c.body(new Uint8Array(ab));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Keine Sätze für")) {
        return c.json({ error: "year_not_configured" }, 400);
      }
      throw err;
    }
  });

  return app;
}
