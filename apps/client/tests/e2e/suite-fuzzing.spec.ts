import { expect, test } from "@playwright/test";

test("synthesizes deterministic edge cases, dry-runs them, and saves selected cases to suite", async ({
  page,
  request,
}) => {
  const suiteName = "e2e-fuzz-target-suite";
  await request.delete(`/api/v1/suites/${suiteName}`);

  const createRes = await request.post("/api/v1/suites", {
    data: {
      name: suiteName,
      description: "Suite for E2E fuzzing verification",
      min_pass_rate: 1.0,
      target: {
        type: "prompt",
        model: "mock/simulator",
        template: "Classify ticket: {{ticket}}",
      },
      tests: [
        {
          id: "seed-case",
          description: "Base ticket case",
          vars: { ticket: "My invoice was charged twice" },
          assertions: [{ type: "not_contains", value: "FORBIDDEN_TOKEN", strict: true }],
        },
      ],
    },
  });
  expect(createRes.ok()).toBeTruthy();

  try {
    await page.goto("/suites");
    await page.getByRole("heading", { name: suiteName, level: 4 }).click();

    await page.getByRole("button", { name: "Generate Edge Cases", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Generate Edge Cases: ${suiteName}`);

    const maxInput = dialog.getByLabel("Max Edge Cases (1–50)");
    await maxInput.fill("3");

    await dialog.getByRole("button", { name: "Synthesize & Dry-Run", exact: true }).click();

    await expect(dialog.getByText("CANDIDATE EDGE CASES (3)", { exact: true })).toBeVisible();
    await expect(dialog.getByText("seed-case-fuzz-empty", { exact: true })).toBeVisible();
    await expect(dialog.getByText("seed-case-fuzz-injection", { exact: true })).toBeVisible();
    await expect(dialog.getByText("seed-case-fuzz-escaping", { exact: true })).toBeVisible();

    // Uncheck the third case so only 2 are added
    await dialog.getByLabel("seed-case-fuzz-escaping", { exact: true }).uncheck();
    const saveBtn = dialog.getByRole("button", {
      name: "Add Selected to Suite (2)",
      exact: true,
    });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Test Cases (3)", exact: true })).toBeVisible();
    await expect(page.getByText("#seed-case-fuzz-empty", { exact: true })).toBeVisible();
    await expect(page.getByText("#seed-case-fuzz-injection", { exact: true })).toBeVisible();
  } finally {
    await request.delete(`/api/v1/suites/${suiteName}`);
  }
});
