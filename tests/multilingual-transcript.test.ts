import assert from "node:assert/strict";
import test from "node:test";

import {
  matchToExistingOption,
  MULTILINGUAL_EXTRACTION_INSTRUCTION,
} from "../src/modules/ai/ai-extraction.policy";
import { transcriptForStorage } from "../src/modules/logs/transcript.policy";

const transcripts = [
  "There is oil leakage from the hydraulic pump and severity is high.",
  "हाइड्रोलिक पंप से ऑयल लीक हो रहा है और समस्या गंभीर है।",
  "Hydraulic pump se oil leak ho raha hai aur severity high hai.",
  "Pump number four में vibration बहुत ज़्यादा है and bearing noise is also high.",
];

test("transcript persistence preserves English, Hindi, Hinglish, and mixed scripts", () => {
  for (const transcript of transcripts) {
    assert.equal(transcriptForStorage(transcript), transcript);
  }
});

test("transcript persistence only trims outer whitespace", () => {
  assert.equal(transcriptForStorage(`  ${transcripts[1]}  `), transcripts[1]);
  assert.equal(transcriptForStorage("   "), null);
  assert.equal(transcriptForStorage(null), null);
});

test("AI extraction policy forbids translation or transcript replacement", () => {
  assert.match(MULTILINGUAL_EXTRACTION_INSTRUCTION, /English, Hindi, Hinglish/);
  assert.match(MULTILINGUAL_EXTRACTION_INSTRUCTION, /Never translate/);
  assert.match(MULTILINGUAL_EXTRACTION_INSTRUCTION, /replacement transcript/);
  assert.match(MULTILINGUAL_EXTRACTION_INSTRUCTION, /Return only the requested structured fields/);
});

test("multilingual extraction output still uses deterministic Master Data matching", () => {
  const issueOptions = ["Oil Leakage", "Excessive Vibration", "Bearing Noise"];
  const severityOptions = ["Low", "Medium", "High"];

  assert.equal(matchToExistingOption("oil leakage", issueOptions), "Oil Leakage");
  assert.equal(matchToExistingOption("High", severityOptions), "High");
  assert.equal(matchToExistingOption("bearing noise observed", issueOptions), null);
  assert.equal(matchToExistingOption("", severityOptions), null);
});
