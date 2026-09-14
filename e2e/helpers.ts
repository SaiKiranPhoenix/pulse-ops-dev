import { expect, type Page } from "@playwright/test";

export type OnboardedProject = {
  readonly email: string;
  readonly password: string;
  readonly projectName: string;
  readonly projectId: string;
  readonly apiKey: string;
  readonly accessToken: string;
};

export function uniqueRunId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function registerAndCreateProject(
  page: Page,
  runId: string,
): Promise<OnboardedProject> {
  const password = ["PulseOps", runId, "pass8"].join("-");
  const email = `${runId}@example.test`;
  const projectName = `E2E ${runId}`;
  const projectSlug = runId.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  await page.goto("/register");
  await page.getByLabel("Name").fill("PulseOps E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard\/setup/);
  await expect(page.getByRole("heading", { name: "Connect your first application" })).toBeVisible();

  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Slug").fill(projectSlug);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText(`Current project: ${projectName}`)).toBeVisible();

  await page.getByLabel("Key name").fill(`key-${runId}`);
  await page.getByRole("button", { name: "Generate key" }).click();
  await expect(page.getByText("API key created. Copy it now")).toBeVisible();

  const pageText = await page.locator("body").innerText();
  const apiKey = pageText.match(/po_live_[A-Za-z0-9_-]+/)?.[0];
  const { accessToken, projectId } = await page.evaluate(() => ({
    accessToken: localStorage.getItem("pulseops.accessToken"),
    projectId: localStorage.getItem("pulseops.selectedProjectId"),
  }));

  expect(apiKey).toBeTruthy();
  expect(accessToken).toBeTruthy();
  expect(projectId).toBeTruthy();

  return {
    email,
    password,
    projectName,
    projectId: String(projectId),
    apiKey: String(apiKey),
    accessToken: String(accessToken),
  };
}

export async function apiGetData<TData>(page: Page, path: string): Promise<TData> {
  const accessToken = await page.evaluate(() => localStorage.getItem("pulseops.accessToken"));
  expect(accessToken).toBeTruthy();

  const response = await page.request.get(`${apiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { readonly data: TData };
  return body.data;
}

export async function waitForPageText(
  page: Page,
  text: string | RegExp,
  options: { readonly timeout?: number } = {},
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        return await page.getByText(text).count();
      },
      {
        timeout: options.timeout ?? 60_000,
        intervals: [1_000, 2_000, 3_000],
      },
    )
    .toBeGreaterThan(0);
}

export function apiBaseUrl(): string {
  return process.env.PULSEOPS_E2E_API_URL ?? "http://localhost:4000";
}
