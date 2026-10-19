export let allPassed = true;
export function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    allPassed = false;
  } else {
    console.log(`PASS: ${message}`);
  }
}
export function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      console.error(`FAIL: ${message} (Expected: ${expected}, Actual: ${actual})`);
      allPassed = false;
    } else {
      console.log(`PASS: ${message}`);
    }
}
export function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      console.error(`FAIL: ${message}`);
      console.error(`  Expected: ${expectedStr}`);
      console.error(`  Got:      ${actualStr}`);
      allPassed = false;
    } else {
      console.log(`PASS: ${message}`);
    }
}
export function assertSameTagSet(actual, expected, message) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((x) => !actualSet.has(x));
  const extra = [...actualSet].filter((x) => !expectedSet.has(x));
  if (missing.length > 0 || extra.length > 0) {
    console.error(`FAIL: ${message}`);
    console.error(`  Expected: ${Array.from(expectedSet).join(", ")}`);
    console.error(`  Actual:   ${Array.from(actualSet).join(", ")}`);
    if (missing.length > 0) console.error(`  Missing:  ${missing.join(", ")}`);
    if (extra.length > 0) console.error(`  Extra:    ${extra.join(", ")}`);
    allPassed = false;
  } else {
    console.log(`PASS: ${message}`);
  }
}
export function finalizeTests() {
  console.log("");
  if (allPassed) {
    console.log("All tests passed!");
    process.exit(0);
  } else {
    console.error("Some tests failed!");
    process.exit(1);
  }
}
