#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/common.mjs
//
// Usage: node scripts/test-common.mjs
// ---------------------------------------------------------------------------

// Set required environment variables before importing common.mjs (imports are hoisted, so we must use dynamic import)
process.env.TENANT_URL = "https://mock.identitynow-demo.com";
process.env.CLIENT_ID = "mock_client_id";
process.env.CLIENT_SECRET = "mock_client_secret";

const { apiCall, MAX_RETRIES, setTenantUrl, API_VERSION, TENANT_NAME, requiredEnv, authenticate, getAccessToken, sleep, resolveTenantUrl } = await import("./common.mjs");
const { assert, finalizeTests } = await import("./test-utils.mjs");

async function runTests() {
  console.log("Testing common.mjs...\n");

  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;

  // Mock setTimeout to immediately resolve (speeds up retry tests)
  global.setTimeout = (cb) => cb();

  try {

    // ---------------------------------------------------------------------------
    // requiredEnv: Check required environment variables
    // ---------------------------------------------------------------------------
    {
      process.env.TEST_REQUIRED_ENV = "some_value";
      const val = requiredEnv("TEST_REQUIRED_ENV");
      assert(val === "some_value", "requiredEnv: Returns value when present");
      delete process.env.TEST_REQUIRED_ENV;

      const originalExit = process.exit;
      const originalError = console.error;
      let exitCode = null;
      let errorMessage = "";

      process.exit = (code) => {
        exitCode = code;
      };

      console.error = (msg) => {
        errorMessage = msg;
      };

      requiredEnv("MISSING_TEST_ENV");

      process.exit = originalExit;
      console.error = originalError;

      assert(exitCode === 1, "requiredEnv: Exits with code 1 when missing");
      assert(errorMessage.includes("ERROR: Missing required environment variable: MISSING_TEST_ENV"), "requiredEnv: Logs correct error message");
    }

    // ---------------------------------------------------------------------------
    // TENANT_NAME Extraction Test
    // ---------------------------------------------------------------------------
    {
      const child_process = await import('child_process');

      assert(TENANT_NAME === "mock", "TENANT_NAME Check: Correctly parsed from TENANT_URL when TENANT_NAME env var is unset");

      let overrideResult = "";
      try {
        overrideResult = child_process.execSync('node --input-type=module -e "import { TENANT_NAME } from \\"./scripts/common.mjs\\"; console.log(TENANT_NAME);"', {
          env: { ...process.env, TENANT_NAME: "override_name" },
          stdio: 'pipe'
        }).toString().trim();
      } catch (e) {
        console.error("Failed to run sub-process for TENANT_NAME override check:", e);
      }
      assert(overrideResult === "override_name", "TENANT_NAME Check: Environment variable TENANT_NAME takes precedence over URL parsing");
    }

    // ---------------------------------------------------------------------------
    // setTenantUrl: Override target tenant URL
    // ---------------------------------------------------------------------------
    {
      let requestedUrl = "";
      global.fetch = async (url) => {
        requestedUrl = url;
        return { ok: true, status: 200, text: async () => "{}" };
      };

      // Test clean URL
      setTenantUrl("https://override.example.com");
      await apiCall("GET", "/test-path");
      assert(requestedUrl === "https://override.example.com/test-path", "setTenantUrl: Uses overridden URL");

      // Test URL with trailing slashes
      setTenantUrl("https://override-trailing.example.com///");
      await apiCall("GET", "/test-path");
      assert(requestedUrl === "https://override-trailing.example.com/test-path", "setTenantUrl: Trims trailing slashes");

      // Reset override
      setTenantUrl("");
    }

    // ---------------------------------------------------------------------------
    // HTTPS Enforcement Test
    // ---------------------------------------------------------------------------
    {
      const child_process = await import('child_process');
      let errorThrown = false;
      try {
        child_process.execSync('node scripts/common.mjs', {
          env: { ...process.env, TENANT_URL: "http://insecure.identitynow-demo.com" },
          stdio: 'pipe'
        });
      } catch (e) {
        errorThrown = true;
        assert(e.stderr.toString().includes("TENANT_URL must use HTTPS"), "HTTPS Check: Correctly rejected http:// URL");
      }
      assert(errorThrown, "HTTPS Check: Should throw error and exit for non-https URL");
    }

    // ---------------------------------------------------------------------------
    // apiCall: Happy path (200 OK)
    // ---------------------------------------------------------------------------
    {
      let fetchCalled = 0;
      global.fetch = async (url, options) => {
        fetchCalled++;
        assert(url === "https://mock.identitynow-demo.com/v3/users", "Happy path: Correct URL");
        assert(options.method === "GET", "Happy path: Correct method");
        return {
          ok: true,
          status: 200,
          text: async () => '{"id":"user123"}',
        };
      };

      const res = await apiCall("GET", "/v3/users");
      assert(res.id === "user123", "Happy path: Returns parsed JSON");
      assert(fetchCalled === 1, "Happy path: Called fetch exactly once");
    }

    // ---------------------------------------------------------------------------
    // apiCall: Happy path (204 No Content)
    // ---------------------------------------------------------------------------
    {
      let fetchCalled = 0;
      global.fetch = async () => {
        fetchCalled++;
        return {
          ok: true,
          status: 204,
        };
      };

      const res = await apiCall("DELETE", "/v3/users/123");
      assert(res === null, "Happy path 204: Returns null");
      assert(fetchCalled === 1, "Happy path 204: Called fetch exactly once");
    }

    // ---------------------------------------------------------------------------
    // apiCall: Error path (400 Bad Request) - No retries
    // ---------------------------------------------------------------------------
    {
      let fetchCalled = 0;
      global.fetch = async () => {
        fetchCalled++;
        return {
          ok: false,
          status: 400,
          text: async () => "Invalid input",
        };
      };

      let errorThrown = null;
      try {
        await apiCall("POST", "/v3/users", { name: "test" });
      } catch (e) {
        errorThrown = e;
      }

      assert(errorThrown !== null, "400 Bad Request: Throws error");
      assert(errorThrown.message.includes("HTTP 400"), "400 Bad Request: Error message includes HTTP 400");
      assert(errorThrown.message.includes("Invalid input"), "400 Bad Request: Error message includes response text");
      assert(fetchCalled === 1, "400 Bad Request: No retries occurred");
    }

    // ---------------------------------------------------------------------------
    // apiCall: Retry path (429 Too Many Requests)
    // ---------------------------------------------------------------------------
    {
      let fetchCalled = 0;
      global.fetch = async () => {
        fetchCalled++;
        if (fetchCalled === 1) {
          return { ok: false, status: 429, text: async () => "Rate limit exceeded" };
        }
        return { ok: true, status: 200, text: async () => '{"success":true}' };
      };

      // Suppress console.warn for the retry
      const originalWarn = console.warn;
      console.warn = () => {};

      const res = await apiCall("GET", "/v3/status");

      console.warn = originalWarn; // Restore warn

      assert(res.success === true, "429 Retry: Returns success after retry");
      assert(fetchCalled === 2, "429 Retry: Retried exactly once");
    }

    // ---------------------------------------------------------------------------
    // apiCall: Retry path (500 Internal Server Error)
    // ---------------------------------------------------------------------------
    {
      let fetchCalled = 0;
      global.fetch = async () => {
        fetchCalled++;
        if (fetchCalled <= 2) {
          return { ok: false, status: 500, text: async () => "Internal Server Error" };
        }
        return { ok: true, status: 200, text: async () => '{"success":true}' };
      };

      // Suppress console.warn for the retry
      const originalWarn = console.warn;
      console.warn = () => {};

      const res = await apiCall("GET", "/v3/status");

      console.warn = originalWarn; // Restore warn

      assert(res.success === true, "500 Retry: Returns success after retries");
      assert(fetchCalled === 3, "500 Retry: Retried twice");
    }

    // ---------------------------------------------------------------------------
    // apiCall: Max Retries Exceeded (returns 500 continuously)
    // ---------------------------------------------------------------------------
    {
      let fetchCalled = 0;
      global.fetch = async () => {
        fetchCalled++;
        return { ok: false, status: 500, text: async () => "Internal Server Error" };
      };

      // Suppress console.warn for the retry
      const originalWarn = console.warn;
      console.warn = () => {};

      let errorThrown = null;
      try {
        await apiCall("GET", "/v3/status");
      } catch (e) {
        errorThrown = e;
      }

      console.warn = originalWarn; // Restore warn

      assert(errorThrown !== null, "Max Retries: Throws error");
      assert(errorThrown.message.includes(`failed after ${MAX_RETRIES} retries`), "Max Retries: Correct error message");
      assert(fetchCalled === MAX_RETRIES, `Max Retries: Called fetch exactly ${MAX_RETRIES} times (with retries)`);
    }

    // ---------------------------------------------------------------------------
    // Authentication Tests
    // ---------------------------------------------------------------------------
    {
      const origFetch = global.fetch;
      let requestedUrl = "";
      let fetchCalled = 0;
      global.fetch = async (url) => {
        requestedUrl = url;
        fetchCalled++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: "test_access_token_123" }),
        };
      };

      const originalLog = console.log;
      console.log = () => {};
      await authenticate();
      console.log = originalLog;

      assert(fetchCalled === 1, "authenticate: Called fetch exactly once");
      assert(requestedUrl.includes("/oauth/token"), "authenticate: Called correct OAuth endpoint");

      const token = getAccessToken();
      assert(token === "test_access_token_123", "getAccessToken: Returns token set by authenticate");

      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "" }),
      });

      let errorThrown = false;
      console.log = () => {};
      try {
        await authenticate();
      } catch (e) {
        errorThrown = true;
        assert(e.message.includes("missing access_token"), "authenticate: Throws when token is missing");
      }
      console.log = originalLog;
      assert(errorThrown, "authenticate: Should throw when access token is missing");

      global.fetch = async () => ({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      errorThrown = false;
      console.log = () => {};
      try {
        await authenticate();
      } catch (e) {
        errorThrown = true;
        assert(e.message.includes("Authentication failed: HTTP 401"), "authenticate: Throws on HTTP error");
      }
      console.log = originalLog;
      assert(errorThrown, "authenticate: Should throw on non-200 HTTP response");

      global.fetch = origFetch;
    }

    // ---------------------------------------------------------------------------
    // sleep: Happy path
    // ---------------------------------------------------------------------------
    {
      const prev = global.setTimeout;
      let setTimeoutCalled = false;
      let setTimeoutDelay = 0;
      global.setTimeout = (cb, ms) => {
        setTimeoutCalled = true;
        setTimeoutDelay = ms;
        cb();
      };

      const promise = sleep(150);
      assert(promise instanceof Promise, "sleep: Returns a Promise");
      await promise;
      assert(setTimeoutCalled === true, "sleep: Calls setTimeout");
      assert(setTimeoutDelay === 150, "sleep: Passes correct delay to setTimeout");

      global.setTimeout = prev;
    }

    // ---------------------------------------------------------------------------
    // resolveTenantUrl: Resolve URL from git branch
    // ---------------------------------------------------------------------------
    {
      const child_process = await import('child_process');
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-tenant-test-'));
      const originalCwd = process.cwd();

      try {
        process.chdir(tmpDir);

        child_process.execSync('git init -b main >/dev/null 2>&1');
        child_process.execSync('git config user.email "test@example.com"');
        child_process.execSync('git config user.name "Test User"');

        fs.writeFileSync('README.md', 'Test repo');
        child_process.execSync('git add README.md >/dev/null 2>&1 && git commit -m "Initial commit" >/dev/null 2>&1');

        const branchName = "mock-tenant-resolve-test";
        const invalidBranchName = "mock-tenant-resolve-invalid";

        child_process.execSync(`git checkout -b ${branchName} >/dev/null 2>&1`);
        fs.writeFileSync('.tenant.yaml', 'url: "https://mock-resolved.identitynow-demo.com/"');
        child_process.execSync(`git add .tenant.yaml >/dev/null 2>&1 && git commit -m "Add mock-tenant .tenant.yaml" >/dev/null 2>&1`);

        child_process.execSync(`git checkout main >/dev/null 2>&1`);

        child_process.execSync(`git checkout -b ${invalidBranchName} >/dev/null 2>&1`);
        fs.writeFileSync('.tenant.yaml', 'invalid: true');
        child_process.execSync(`git add .tenant.yaml >/dev/null 2>&1 && git commit -m "Add invalid .tenant.yaml" >/dev/null 2>&1`);

        child_process.execSync(`git checkout main >/dev/null 2>&1`);

        const resolvedUrl = resolveTenantUrl(branchName);
        assert(resolvedUrl === "https://mock-resolved.identitynow-demo.com", "resolveTenantUrl: Resolves valid URL and strips trailing slash");

        let errorThrownInvalid = null;
        try {
          resolveTenantUrl(invalidBranchName);
        } catch (e) {
          errorThrownInvalid = e;
        }
        assert(errorThrownInvalid !== null, "resolveTenantUrl: Throws for missing URL field");
        assert(errorThrownInvalid.message.includes(`Could not resolve URL for tenant "${invalidBranchName}"`), "resolveTenantUrl: Missing URL field error message is correct");

        let errorThrownMissing = null;
        try {
          resolveTenantUrl("non-existent-tenant-12345");
        } catch (e) {
          errorThrownMissing = e;
        }
        assert(errorThrownMissing !== null, "resolveTenantUrl: Throws for non-existent branch");
        assert(errorThrownMissing.message.includes(`Could not resolve URL for tenant "non-existent-tenant-12345"`), "resolveTenantUrl: Non-existent branch error message is correct");

      } finally {
        process.chdir(originalCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    // ---------------------------------------------------------------------------
    // API_VERSION
    // ---------------------------------------------------------------------------
    {
      assert(typeof API_VERSION === "string", "API_VERSION: Is a string");
      assert(API_VERSION === "v2025", "API_VERSION: Has expected value");
    }

  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
  }

  finalizeTests();
}

await runTests();
