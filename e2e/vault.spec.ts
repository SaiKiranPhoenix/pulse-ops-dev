import { expect, test } from "@playwright/test";
import { apiBaseUrl, registerAndCreateProject, uniqueRunId, waitForPageText } from "./helpers";

test("creates, reveals, token-fetches, and audits a vault secret", async ({ page }) => {
  const runId = uniqueRunId("vault");
  await registerAndCreateProject(page, runId);

  const vaultPassword =
    process.env.PULSEOPS_E2E_VAULT_PASSWORD ??
    ["replace", "with", "local", "vault", "master", "password"].join("-");
  const secretKey = `E2E_SECRET_${runId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
  const secretValue = ["e2e", runId, "value"].join("-");

  await page.goto("/dashboard/vault");
  await expect(page.getByRole("heading", { name: "Vault workbench" })).toBeVisible();

  await page.getByPlaceholder("vault password").first().fill(vaultPassword);
  await page.getByPlaceholder("confirm vault password").fill(vaultPassword);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Vault unlocked for this browser session.")).toBeVisible();

  await page.getByLabel("Secret key").fill(secretKey);
  await page.getByLabel("Secret value").fill(secretValue);
  await page.getByRole("button", { name: "Save encrypted secret" }).click();
  await expect(page.getByText("Secret stored encrypted.")).toBeVisible();
  await expect(page.getByText(secretKey, { exact: true }).first()).toBeVisible();

  await page.locator("article").filter({ hasText: secretKey }).getByRole("button").first().click();
  const revealPanel = page.locator("section").filter({ hasText: "Reveal secret" }).last();
  await revealPanel.getByPlaceholder("vault password").fill(vaultPassword);
  await revealPanel.getByRole("button", { name: "Reveal value" }).click();
  await expect(page.getByText("Revealed value")).toBeVisible();
  await expect(page.getByText(secretValue)).toBeVisible();
  await page.getByRole("button", { name: "Close reveal panel" }).click();

  await page.getByLabel("Token name").fill(`token-${runId}`);
  await page.getByRole("button", { name: "Create read token" }).click();
  await expect(page.getByText("Vault integration token created. Copy it now")).toBeVisible();

  const rawTokenText = await page
    .locator("section")
    .filter({ hasText: "Raw integration token shown once" })
    .innerText();
  const rawToken = rawTokenText.match(/povt_[A-Za-z0-9_-]+/)?.[0];
  expect(rawToken).toBeTruthy();

  const externalFetchForm = page.locator("form").filter({ hasText: "Test external fetch" });
  await externalFetchForm.getByPlaceholder("raw integration token").fill(String(rawToken));
  await externalFetchForm.getByPlaceholder("DATABASE_URL").fill(secretKey);

  const integrationResponse = await page.request.get(
    `${apiBaseUrl()}/integrations/vault/secrets/production/${encodeURIComponent(secretKey)}`,
    { headers: { "x-vault-token": String(rawToken) } },
  );
  expect(integrationResponse.ok()).toBe(true);
  const integrationBody = (await integrationResponse.json()) as {
    readonly data: { readonly secret: { readonly key: string; readonly value: string } };
  };
  expect(integrationBody.data.secret).toMatchObject({ key: secretKey, value: secretValue });

  await waitForPageText(page, "vault.secret.reveal");
  await expect(page.getByText("vault.integration.fetch")).toBeVisible();
});
