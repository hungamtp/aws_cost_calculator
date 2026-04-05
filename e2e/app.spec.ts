import { test, expect } from '@playwright/test';

test('Cost Estimator Visual Canvas renders correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('AWS Cost Estimator')).toBeVisible();
  
  // Verify palette tools are completely loaded
  await expect(page.getByText('Compute')).toBeVisible();
  await expect(page.getByText('Amazon EC2')).toBeVisible();
});

test('Wizard interacts correctly to spawn architecture nodes', async ({ page }) => {
  await page.goto('/');
  
  // Open the wizard utilizing the Wand icon button
  // Playwright tests DOM layout so locating the slide-out navigation button
  await page.locator('nav button').nth(1).click();
  
  await expect(page.getByText('Smart Intake Form')).toBeVisible();
  
  // Automatically inject architecture
  await page.getByText('Apply Architecture to Canvas').click();

  // Validate the components rendered onto the interactive canvas mapping correctly
  await expect(page.getByText('Application Load Balancer')).toBeVisible();
  await expect(page.getByText('$82.50')).toBeVisible();
});
