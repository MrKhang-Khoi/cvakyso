import { test, expect } from '@playwright/test';

test('Diagnose live site on GitHub Pages', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type()}]: ${msg.text()}`);
  });

  page.on('requestfailed', req => {
    console.log(`[REQUEST FAILED]: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`[HTTP ${resp.status()}]: ${resp.request().method()} ${resp.url()}`);
    }
  });

  console.log('Navigating to live GitHub Pages...');
  await page.goto('https://mrkhang-khoi.github.io/cvakyso/', { waitUntil: 'networkidle' });

  // Check which version of app.js is loaded
  const scriptSrc = await page.evaluate(() => {
    const s = document.querySelector('script[src*="app.js"]');
    return s ? s.src : null;
  });
  console.log('Live script src:', scriptSrc);

  // Login as admin
  const loginInput = page.locator('#loginUsername');
  if (await loginInput.isVisible()) {
    await loginInput.fill('admin');
    await page.locator('#loginPassword').fill('admin@123');
    await page.locator('#btnLoginSubmit').click();
    await page.waitForTimeout(2000);
  }

  // Go to Teachers tab if needed
  const teachersTabBtn = page.locator('#tabBtnTeachers, button:has-text("Danh sách Giáo viên")').first();
  if (await teachersTabBtn.isVisible()) {
    await teachersTabBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check HA VAN TY in table
  const tyRow = page.locator('tr:has-text("HA VAN TY")');
  console.log('HA VAN TY row visible:', await tyRow.isVisible());
  console.log('HA VAN TY row text:', await tyRow.innerText());

  // Click edit HA VAN TY
  const editBtn = tyRow.locator('button[title="Sửa thông tin"], button:has-text("Sửa")').first();
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForTimeout(1000);
  } else {
    // Open via evaluate
    await page.evaluate(() => {
      const ty = appState.users.find(u => u.username === 'cva.ty');
      if (ty) window.openModalEditUser(ty.id);
    });
    await page.waitForTimeout(1000);
  }

  const sealCheckbox = page.locator('#userCanStampSeal');
  console.log('Seal checkbox visible:', await sealCheckbox.isVisible());
  console.log('Seal checkbox checked before:', await sealCheckbox.isChecked());

  // Uncheck
  await sealCheckbox.uncheck();
  console.log('Seal checkbox checked after uncheck:', await sealCheckbox.isChecked());

  // Save
  console.log('Clicking save...');
  await page.locator('#formUser button[type=submit]').click();
  await page.waitForTimeout(3000);

  // Check table again
  console.log('HA VAN TY row text after save:', await tyRow.innerText());

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/live_diagnose_after_save.png', fullPage: true });

  // Re-open modal to verify
  await page.evaluate(() => {
    const ty = appState.users.find(u => u.username === 'cva.ty');
    if (ty) window.openModalEditUser(ty.id);
  });
  await page.waitForTimeout(1000);
  console.log('Seal checkbox checked on re-open:', await sealCheckbox.isChecked());
  await page.screenshot({ path: 'tests/screenshots/live_diagnose_reopened.png' });
});
