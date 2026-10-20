import { expect, test, APIRequestContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function prepare(request: APIRequestContext, page: Page) {
  const name = "prompt-" + randomUUID().slice(0, 8);
  const suite = {
    name,
    target: { model: "mock/simulator", template: "wrong {{question}}", temperature: 0.3 },
    min_pass_rate: 1,
    tests: [
      { id: "first", vars: { question: "First" }, assertions: [{ type: "contains", value: "correct" }] },
      { id: "second", repeat: 2, vars: { question: "Second" }, assertions: [{ type: "contains", value: "correct" }] },
    ],
  };
  expect((await request.post("/api/v1/suites", { data: suite })).ok()).toBeTruthy();
  await page.goto("/prompt-arena");
  await page.getByRole("combobox", { name: "Evaluation suite", exact: true }).selectOption(name);
  await expect(page.getByRole("textbox", { name: "Prompt A template", exact: true })).toHaveValue("wrong {{question}}");
  await page.getByRole("textbox", { name: "Prompt B template", exact: true }).fill("correct {{question}}");
  await page.getByRole("textbox", { name: "Prompt B system instructions", exact: true }).fill("Be precise.");
  await page.getByRole("spinbutton", { name: "Prompt attempts per test", exact: true }).fill("3");
  return suite;
}

test("Prompt Arena captures estimates, saves evidence, restores history, and applies only a prompt", async ({ page, request }) => {
  const source = await prepare(request, page);
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/arena/prompts/estimate", async route => {
    const response = await route.fetch();
    await hold;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole("button", { name: "Compare prompts", exact: true }).click();
    await page.getByRole("textbox", { name: "Prompt B template", exact: true }).fill("wrong later");
    await page.getByRole("spinbutton", { name: "Prompt attempts per test", exact: true }).fill("9");
  } finally {
    release();
  }
  await expect(page.getByRole("dialog")).toContainText("A: 5 attempts · B: 5 attempts");
  const completed = page.waitForResponse(response => response.url().endsWith("/arena/prompts/compare"));
  await page.getByRole("button", { name: "Start prompt comparison", exact: true }).click();
  const response = await completed;
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  expect(result.prompt_b.template).toBe("correct {{question}}");
  expect(result.repeat).toBe(3);
  expect(result.suite_snapshot.name).toBe(source.name);
  expect(result.comparison.run_a.total_attempts).toBe(5);
  expect(result.comparison.run_b.total_attempts).toBe(5);
  const view = page.getByRole("region", { name: "Prompt comparison results", exact: true });
  await expect(view).toContainText("Prompt B has the higher observed pass rate");
  await expect(view).toContainText("0/5 attempts passed");
  await expect(view).toContainText("5/5 attempts passed");
  await view.getByText(/^first · A /).click();
  await expect(view.getByText("Mock completion for: correct First", { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Prompt comparison results", exact: true })).toHaveCount(0);
  await page.getByRole("button").filter({ hasText: result.comparison_id }).click();
  await expect(page.getByRole("region", { name: "Prompt comparison results", exact: true })).toContainText(result.comparison_id);
  await page.getByRole("button", { name: "Apply prompt B to suite", exact: true }).click();
  await expect(page.getByText("Prompt applied to suite.", { exact: true })).toBeVisible();
  const applied = await (await request.get("/api/v1/suites/" + source.name)).json();
  expect(applied.target.template).toBe("correct {{question}}");
  expect(applied.target.system_prompt).toBe("Be precise.");
  expect(applied.target.model).toBe(source.target.model);
  expect(applied.target.temperature).toBe(0.3);
  expect(applied.tests[1].repeat).toBe(2);
  const reopened = await (await request.get("/api/v1/arena/prompts/" + result.comparison_id)).json();
  expect(reopened.suite_snapshot.target.template).toBe("wrong {{question}}");

  await page.goto("/docs/prompt-arena");
  await expect(page.getByRole("heading", { name: "Prompt Arena", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prompt Arena API", exact: true })).toBeVisible();
});

test("Prompt Arena refuses a stale estimated suite before making inference calls", async ({ page, request }) => {
  const source = await prepare(request, page);
  await page.getByRole("button", { name: "Compare prompts", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const updated = await request.put("/api/v1/suites/" + source.name, {
    data: { ...source, description: "Edited in another window" },
  });
  expect(updated.ok()).toBeTruthy();
  const before = await (await request.get("/api/v1/runs?suite=" + source.name)).json();
  expect(before).toHaveLength(0);
  await page.getByRole("button", { name: "Start prompt comparison", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Suite changed" })).toBeVisible();
  expect(await (await request.get("/api/v1/runs?suite=" + source.name)).json()).toHaveLength(0);
});


test("Prompt Arena completes through the production proxy after more than 30 seconds", async ({ page, request }) => {
  test.setTimeout(90_000);
  await prepare(request, page);
  await page.getByRole("textbox", { name: "Prompt A template", exact: true }).fill("slow-proxy-regression wrong {{question}}");
  await page.getByRole("textbox", { name: "Prompt B template", exact: true }).fill("slow-proxy-regression correct {{question}}");
  await page.getByRole("button", { name: "Compare prompts", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("A: 5 attempts · B: 5 attempts");
  const completed = page.waitForResponse(response => response.url().endsWith("/arena/prompts/compare"), { timeout: 70_000 });
  const started = Date.now();
  await page.getByRole("button", { name: "Start prompt comparison", exact: true }).click();
  const response = await completed;
  expect(response.ok()).toBeTruthy();
  expect(Date.now() - started).toBeGreaterThan(30_000);
  const result = await response.json();
  expect(result.comparison.run_a.total_attempts).toBe(5);
  expect(result.comparison.run_b.total_attempts).toBe(5);
  const view = page.getByRole("region", { name: "Prompt comparison results", exact: true });
  await expect(view).toContainText("Prompt B has the higher observed pass rate");
  await expect(view).toContainText("5/5 attempts passed");
  const saved = await request.get("/api/v1/arena/prompts/" + result.comparison_id);
  expect(saved.ok()).toBeTruthy();
  expect(await saved.json()).toEqual(result);
});
