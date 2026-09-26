import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";

import {
  EQUIPMENT_MANUAL_MAX_FILE_SIZE_BYTES,
  hasPdfSignature,
  isManualFileSizeAllowed,
  isPdfManualDescriptor,
} from "../src/modules/equipment-manuals/equipment-manual-upload.policy";
import { errorMiddleware } from "../src/middlewares/error.middleware";
import { singleManualUploadMiddleware } from "../src/modules/uploads/uploads.middleware";

test("manual upload accepts a representative 7.7 MB PDF", () => {
  assert.equal(isManualFileSizeAllowed(Math.round(7.7 * 1024 * 1024)), true);
});

test("manual upload accepts the 10 MB boundary and rejects larger files", () => {
  assert.equal(isManualFileSizeAllowed(EQUIPMENT_MANUAL_MAX_FILE_SIZE_BYTES), true);
  assert.equal(isManualFileSizeAllowed(EQUIPMENT_MANUAL_MAX_FILE_SIZE_BYTES + 1), false);
});

test("manual upload requires a PDF MIME type and extension", () => {
  assert.equal(
    isPdfManualDescriptor({ mimeType: "application/pdf", fileName: "pump-manual.pdf" }),
    true,
  );
  assert.equal(
    isPdfManualDescriptor({ mimeType: "text/plain", fileName: "pump-manual.pdf" }),
    false,
  );
  assert.equal(
    isPdfManualDescriptor({ mimeType: "application/pdf", fileName: "pump-manual.txt" }),
    false,
  );
});

test("manual upload verifies the PDF file signature", () => {
  assert.equal(hasPdfSignature(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(hasPdfSignature(Buffer.from("not a pdf")), false);
});

test("manual multipart middleware enforces the complete 10 MB rule", async () => {
  const app = express();
  app.post("/manual", singleManualUploadMiddleware, (request, response) => {
    response.status(200).json({ size: request.file?.size });
  });
  app.use(errorMiddleware);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  async function upload(size: number, type = "application/pdf", name = "manual.pdf") {
    const bytes = new Uint8Array(size);
    bytes.set(Buffer.from("%PDF-"));
    const body = new FormData();
    body.append("file", new Blob([bytes], { type }), name);
    return fetch(`http://127.0.0.1:${port}/manual`, { method: "POST", body });
  }

  try {
    assert.equal((await upload(Math.round(7.7 * 1024 * 1024))).status, 200);
    assert.equal((await upload(EQUIPMENT_MANUAL_MAX_FILE_SIZE_BYTES)).status, 200);

    const oversized = await upload(EQUIPMENT_MANUAL_MAX_FILE_SIZE_BYTES + 1);
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).message, "PDF must be 10 MB or smaller.");

    const nonPdf = await upload(1024, "text/plain", "manual.txt");
    assert.equal(nonPdf.status, 400);
    assert.equal((await nonPdf.json()).message, "Only PDF manual files are allowed.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
