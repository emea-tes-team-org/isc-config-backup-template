#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/token-utils.mjs
//
// Usage: node scripts/test-token-utils.mjs
// ---------------------------------------------------------------------------

import {
  getPath,
  setPath,
  nameToPrefix,
  sanitizeName,
  parseVarsYaml
} from "./token-utils.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

console.log("Testing token-utils.mjs...\n");

// ---------------------------------------------------------------------------
// getPath tests
// ---------------------------------------------------------------------------
const testObj = {
  a: {
    b: {
      c: 42,
      d: [10, 20, { e: 30 }]
    }
  },
  x: null,
  y: undefined
};

assert(getPath(testObj, ["a", "b", "c"]) === 42, "getPath retrieves nested value");
assert(getPath(testObj, ["a", "b", "d", 0]) === 10, "getPath works with array indices");
assert(getPath(testObj, ["a", "b", "d", 2, "e"]) === 30, "getPath works with nested array and object");

assert(getPath(testObj, ["a", "z"]) === undefined, "getPath returns undefined for missing key");
assert(getPath(testObj, ["missing", "path"]) === undefined, "getPath handles missing root key");

assert(getPath(testObj, ["x", "foo"]) === undefined, "getPath handles traversal through null");
assert(getPath(testObj, ["y", "foo"]) === undefined, "getPath handles traversal through undefined");

assert(getPath(testObj, ["a", "b", "c", "foo"]) === undefined, "getPath handles traversal through primitive");

assert(getPath(null, ["a"]) === undefined, "getPath handles null object");
assert(getPath(undefined, ["a"]) === undefined, "getPath handles undefined object");

// ---------------------------------------------------------------------------
// setPath tests
// ---------------------------------------------------------------------------
let setObj = {};

setPath(setObj, ["a", "b", "c"], 42);
assertDeepEqual(setObj, { a: { b: { c: 42 } } }, "setPath creates nested objects");

setPath(setObj, ["a", "b", "d"], "hello");
assertDeepEqual(setObj, { a: { b: { c: 42, d: "hello" } } }, "setPath adds new key to existing object");

setPath(setObj, ["a", "b", "c"], 99);
assertDeepEqual(setObj, { a: { b: { c: 99, d: "hello" } } }, "setPath updates existing value");

let arrayObj = {};
setPath(arrayObj, ["list", 0, "value"], "first");
// setPath creates an array when the *next* path segment is a number
assertDeepEqual(arrayObj, { list: [{ value: "first" }] }, "setPath creates intermediate arrays");

let mutObj = { x: 1 };
setPath(mutObj, ["y", "z"], 2);
assertDeepEqual(mutObj, { x: 1, y: { z: 2 } }, "setPath mutates existing object correctly");

// ---------------------------------------------------------------------------
// nameToPrefix tests
// ---------------------------------------------------------------------------
assert(nameToPrefix("ServiceNow Ticket ven03769") === "SERVICENOW_TICKET_VEN03769", "nameToPrefix converts spaces and alphanumeric");
assert(nameToPrefix("Hello---World") === "HELLO_WORLD", "nameToPrefix handles multiple dashes");
assert(nameToPrefix("  Spaces At Ends  ") === "SPACES_AT_ENDS", "nameToPrefix trims spaces");
assert(nameToPrefix("!@# Special $%^ Chars &*()") === "SPECIAL_CHARS", "nameToPrefix handles special characters");

// ---------------------------------------------------------------------------
// sanitizeName tests
// ---------------------------------------------------------------------------
assert(sanitizeName("Valid Name 123") === "Valid Name 123", "sanitizeName keeps valid name unchanged");
assert(sanitizeName("My <Invalid> Name") === "My -Invalid- Name", "sanitizeName replaces invalid characters");
assert(sanitizeName("File:Name/With\\Slashes") === "File-Name-With-Slashes", "sanitizeName handles slashes and colons");
assert(sanitizeName("Multiple---Dashes") === "Multiple-Dashes", "sanitizeName deduplicates replacement characters");
assert(sanitizeName("  Trim  Me  ") === "Trim  Me", "sanitizeName trims whitespace");
assert(sanitizeName("---Starts And Ends With Dash---") === "Starts And Ends With Dash", "sanitizeName trims dashes");
assert(sanitizeName("<>|*?") === "unnamed", "sanitizeName falls back to 'unnamed' if empty");

// ---------------------------------------------------------------------------
// parseVarsYaml tests
// ---------------------------------------------------------------------------

assertDeepEqual(parseVarsYaml(""), {}, "parseVarsYaml handles empty input");
assertDeepEqual(parseVarsYaml("   \n\n"), {}, "parseVarsYaml handles whitespace only input");

assertDeepEqual(parseVarsYaml("# This is a comment\n\nKEY1: value1\n# Another comment\nKEY2: \"value2\""), { KEY1: "value1", KEY2: "value2" }, "parseVarsYaml handles comments and blank lines");

assertDeepEqual(parseVarsYaml("KEY_NAME: simple value"), { KEY_NAME: "simple value" }, "parseVarsYaml parses simple scalar key/value");
assertDeepEqual(parseVarsYaml("KEY_NAME:   padded value   "), { KEY_NAME: "padded value" }, "parseVarsYaml trims unquoted scalar values");
assertDeepEqual(parseVarsYaml("KEY_NAME: \"quoted value\""), { KEY_NAME: "quoted value" }, "parseVarsYaml strips quotes from scalar value");
assertDeepEqual(parseVarsYaml('KEY_NAME: "value with \\"escapes\\""'), { KEY_NAME: 'value with "escapes"' }, "parseVarsYaml handles escaped quotes in scalar");
assertDeepEqual(parseVarsYaml('KEY_NAME: "value with \\\\slash"'), { KEY_NAME: 'value with \\slash' }, "parseVarsYaml handles escaped backslashes in scalar");

assertDeepEqual(parseVarsYaml("ARRAY_KEY:\n  - item1\n  - item2"), { ARRAY_KEY: ["item1", "item2"] }, "parseVarsYaml parses simple arrays");
assertDeepEqual(parseVarsYaml("ARRAY_KEY:\n  - \"quoted item\"\n  -  padded item  "), { ARRAY_KEY: ["quoted item", "padded item"] }, "parseVarsYaml handles quoted and padded array items");

assertDeepEqual(parseVarsYaml("KEY1: val1\nARR1:\n  - a\n  - b\nKEY2: val2"), { KEY1: "val1", ARR1: ["a", "b"], KEY2: "val2" }, "parseVarsYaml handles scalar after array");

assertDeepEqual(parseVarsYaml("INVALID_LINE without colon\nKEY1: val1"), { KEY1: "val1" }, "parseVarsYaml ignores lines without a colon format");
assertDeepEqual(parseVarsYaml("lower_case_key: val1"), {}, "parseVarsYaml ignores keys that do not match the uppercase regex");

// ---------------------------------------------------------------------------
finalizeTests();
