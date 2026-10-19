#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/compare-utils.mjs
//
// Usage: node scripts/test-compare-utils.mjs
// ---------------------------------------------------------------------------

import { canonicalize } from "./compare-utils.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

console.log("Testing compare-utils.mjs...\n");

try {
  // Test 1: Primitives
  assertDeepEqual(canonicalize(42), 42, "Canonicalize primitive (number)");
  assertDeepEqual(canonicalize("hello"), "hello", "Canonicalize primitive (string)");
  assertDeepEqual(canonicalize(null), null, "Canonicalize primitive (null)");

  // Test 2: Standard objects with unsorted keys
  const obj1 = { b: 2, a: 1 };
  const obj2 = { a: 1, b: 2 };
  assertDeepEqual(canonicalize(obj1), { a: 1, b: 2 }, "Canonicalize object with unsorted keys (keys become sorted)");
  assertDeepEqual(JSON.stringify(canonicalize(obj1)), JSON.stringify(canonicalize(obj2)), "Canonicalize produces same JSON string for objects with differently ordered keys");

  // Test 3: Arrays are sorted by string representation
  const arr1 = [2, 1, 3];
  assertDeepEqual(canonicalize(arr1), [1, 2, 3], "Canonicalize array of primitives (sorted by string value)");

  const arr2 = ["banana", "apple", "cherry"];
  assertDeepEqual(canonicalize(arr2), ["apple", "banana", "cherry"], "Canonicalize array of strings");

  // Test 4: Arrays of objects
  const arrObj1 = [{ d: 4, c: 3 }, { b: 2, a: 1 }];
  const arrObj2 = [{ a: 1, b: 2 }, { c: 3, d: 4 }];
  // Both objects' keys get sorted: {c: 3, d: 4} and {a: 1, b: 2}.
  // Then the string representations are '{"c":3,"d":4}' and '{"a":1,"b":2}'.
  // Sorting them results in '{"a":1,"b":2}' then '{"c":3,"d":4}'.
  assertDeepEqual(
    canonicalize(arrObj1),
    [{ a: 1, b: 2 }, { c: 3, d: 4 }],
    "Canonicalize array of objects (keys sorted, then array sorted by string representation)"
  );
  assertDeepEqual(
    JSON.stringify(canonicalize(arrObj1)),
    JSON.stringify(canonicalize(arrObj2)),
    "Canonicalize produces same JSON string for arrays of differently ordered objects"
  );

  // Test 5: Nested structures
  const nested1 = {
    z: [ { y: 2, x: 1 }, "foo" ],
    a: { c: 3, b: 4 }
  };
  const expectedNested = {
    a: { b: 4, c: 3 },
    z: [ "foo", { x: 1, y: 2 } ]
  };
  assertDeepEqual(canonicalize(nested1), expectedNested, "Canonicalize nested structures");

} catch (err) {
  console.error(`FAIL: Error running canonicalize tests: ${err.message}`);
  console.error(err.stack);
  assert(false, err.message);
}

finalizeTests();
