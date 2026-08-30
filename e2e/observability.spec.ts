import { expect, test } from "@playwright/test";
import { apiGetData, registerAndCreateProject, uniqueRunId, waitForPageText } from "./helpers";

type ErrorGroupResponse = {
  readonly errorGroups: Array<{
    readonly message: string;
    readonly incident: { readonly status: string } | null;
  }>;
};

type IncidentResponse = {
  readonly incidents: Array<{
    readonly title: string;
    readonly status: string;
  }>;
};

test("registers, creates a project and API key, sends telemetry, and sees dashboard updates", async ({
  page,
}) => {
  const runId = uniqueRunId("obs");
  const onboarded = await registerAndCreateProject(page, runId);

  await page.getByRole("button", { name: "Send test log" }).click();
  await expect(page.getByText("log event accepted")).toBeVisible();

  await page.goto("/dashboard/logs");
  await expect(page.getByRole("heading", { name: "Log event explorer" })).toBeVisible();
  await waitForPageText(page, "PulseOps setup test log");

  await page.goto("/dashboard/metrics");
  await expect(page.getByRole("heading", { name: "Metrics explorer" })).toBeVisible();
  await page.getByPlaceholder("Ingestion API key").fill(onboarded.apiKey);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("High-latency metric accepted")).toBeVisible();
  await waitForPageText(page, "checkout.latency");
  await expect(page.getByText("1250ms").first()).toBeVisible();
});

test("sends repeated errors, opens an incident, resolves it, and reopens it", async ({ page }) => {
  const runId = uniqueRunId("inc");
  const onboarded = await registerAndCreateProject(page, runId);

  await page.goto("/dashboard/errors");
  await expect(page.getByRole("heading", { name: "Error groups" })).toBeVisible();
  await page.getByPlaceholder("API key for test").fill(onboarded.apiKey);
  await page
    .getByPlaceholder("API key for test")
    .locator("xpath=ancestor::form")
    .getByRole("button")
    .click();
  await expect(page.getByText("Repeated errors accepted")).toBeVisible();
  await expect
    .poll(
      async () => {
        const data = await apiGetData<ErrorGroupResponse>(
          page,
          `/dashboard/error-groups?projectId=${onboarded.projectId}&environment=production&timeRange=1h`,
        );
        return (
          data.errorGroups.find((group) => group.message.includes("Payment provider timeout"))
            ?.incident?.status ?? "missing"
        );
      },
      { timeout: 90_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe("open");

  await page.reload();
  await expect(page.getByText("Payment provider timeout").first()).toBeVisible();
  await expect(page.getByText("open").first()).toBeVisible();

  await page.goto("/dashboard/alerts");
  await expect(page.getByRole("heading", { name: "Incident workbench" })).toBeVisible();
  await expect
    .poll(
      async () => {
        const data = await apiGetData<IncidentResponse>(
          page,
          `/incidents?projectId=${onboarded.projectId}`,
        );
        return (
          data.incidents.find((incident) => incident.title.includes("Payment provider timeout"))
            ?.status ?? "missing"
        );
      },
      { timeout: 90_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe("open");

  await page.reload();
  await expect(page.getByText("Payment provider timeout").first()).toBeVisible();
  await page.getByText("Payment provider timeout").first().click();

  await page.getByPlaceholder("Resolution note").fill("Resolved by E2E incident workflow.");
  await page.getByRole("button", { name: "Resolve incident" }).click();
  await expect(page.getByText("Incident resolved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen incident" })).toBeVisible();

  await page.getByRole("button", { name: "Reopen incident" }).click();
  await expect(page.getByText("Incident reopened.")).toBeVisible();
});
