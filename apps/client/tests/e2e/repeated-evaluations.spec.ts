import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/suites");
  await page.getByRole("heading", { name: "ci-repeated-evaluation", level: 4 }).click();
});

test("confirmed estimate preserves settings and shows attempt evidence", async ({ page, request }) => {
  const events: { type: string; total_attempts?: number; data?: { attempt_index: number } }[] = [];
  page.on("websocket", socket => {
    socket.on("framereceived", ({ payload }) => events.push(JSON.parse(String(payload))));
  });

  let releaseEstimate!: () => void;
  const holdEstimate = new Promise<void>(resolve => { releaseEstimate = resolve; });
  await page.route("**/estimate-cost", async route => {
    const response = await route.fetch();
    await holdEstimate;
    await route.fulfill({ response });
  });

  const repeat = page.getByRole("spinbutton", { name: "Attempts per test", exact: true });
  const drop = page.getByRole("spinbutton", { name: "Tolerated baseline drop", exact: true });
  try {
    await repeat.fill("4");
    await drop.fill("10");
    await page.getByRole("button", { name: "Run Suite Live", exact: true }).click();
    await repeat.fill("9");
    await drop.fill("99");
  } finally {
    releaseEstimate();
  }

  const estimate = page.getByRole("dialog");
  await expect(estimate).toContainText("2 test cases · 6 attempts");
  await estimate.getByRole("button", { name: "Start 6 attempts", exact: true }).click();
  await expect(page.getByText("6 / 6 attempts completed", { exact: true })).toBeVisible();
  // Attempt progress can reach 100% before persistence and the terminal event.
  await expect.poll(() => events.filter(event => event.type === "run_finished").length).toBe(1);
  await expect(page.getByText("Execution Complete", { exact: true })).toBeVisible();

  expect(events.find(event => event.type === "run_started")?.total_attempts).toBe(6);
  const completed = events.filter(event => event.type === "test_complete");
  expect(completed).toHaveLength(6);
  expect(completed.map(event => event.data?.attempt_index).sort()).toEqual([1, 1, 2, 2, 3, 4]);
  expect(events.filter(event => event.type === "run_finished")).toHaveLength(1);

  const history = await request.get("/api/v1/runs?limit=1&offset=0");
  expect(history.ok()).toBeTruthy();
  const [saved] = await history.json();
  expect(saved).toMatchObject({
    suite_name: "ci-repeated-evaluation",
    total_attempts: 6,
    passed_attempts: 4,
    metadata: { max_success_rate_drop: 0.1 },
  });

  const passing = page.getByRole("region", { name: "Reliability for passing", exact: true });
  await expect(passing).toContainText("4/4 attempts passed");
  await passing.getByText("Inspect attempts", { exact: true }).click();
  await passing.getByText(/^Attempt 4: Passed/).click();
  await expect(passing.getByText("Mock completion for: Hello", { exact: true }).last()).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText("Latest Run: 66.7% (4/6 attempts passed)", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /^History/ }).click();
  await expect(page.getByText("66.7% (4/6 attempts)", { exact: true }).first()).toBeVisible();
});

test("invalid settings block execution and estimate-only has no start button", async ({ page }) => {
  const repeat = page.getByRole("spinbutton", { name: "Attempts per test", exact: true });
  const drop = page.getByRole("spinbutton", { name: "Tolerated baseline drop", exact: true });
  const run = page.getByRole("button", { name: "Run Suite Live", exact: true });
  for (const invalid of ["0", "101", "1.5"]) {
    await repeat.fill(invalid);
    await expect(run).toBeDisabled();
  }
  await repeat.fill("4");
  for (const invalid of ["-1", "101"]) {
    await drop.fill(invalid);
    await expect(run).toBeDisabled();
  }
  await drop.fill("0");
  await expect(run).toBeEnabled();
  await page.getByRole("button", { name: "Estimate Cost", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("2 test cases · 6 attempts");
  await expect(page.getByRole("button", { name: /^Start .* attempts$/ })).toHaveCount(0);
});

test("a failed estimate does not offer execution", async ({ page, request }) => {
  const before = await (await request.get("/api/v1/runs")).json();
  await page.route("**/estimate-cost", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ detail: "CI estimate unavailable" }),
  }));
  await page.getByRole("button", { name: "Run Suite Live", exact: true }).click();
  await expect(page.getByText("CI estimate unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await (await request.get("/api/v1/runs")).json();
  expect(after).toHaveLength(before.length);
});
