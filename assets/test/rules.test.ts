import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check, length, type Refusal, type Rules } from "../src/rules";

interface Case {
  rules: Rules;
  values: string[];
  known: string[] | null;
  expected: Refusal | null;
}

// The same answers as Erabi.Rules on the server.
const cases = JSON.parse(readFileSync("../test/fixtures/rules.json", "utf8")) as Case[];

test("the rules give the answers of Erabi.Rules", () => {
  assert.ok(cases.length > 20);
  for (const { rules, values, known, expected } of cases) {
    assert.deepEqual(check(rules, values, known), expected, `${JSON.stringify(values)} with ${JSON.stringify(rules)}`);
  }
});

test("a length is in characters as people count them", () => {
  assert.equal(length("café"), 4);
  assert.equal(length("👍🏽"), 1);
  assert.equal(length("🇵🇹"), 1);
});
