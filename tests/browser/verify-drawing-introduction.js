async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // UI-only fixture in the isolated CLI browser. Real AI/quota is verified in the user's in-app tab.
  await page.route('**/src/App.tsx', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/\buseEffect\(/g, '(() => {})(') });
  });
  await page.addInitScript(() => {
    localStorage.setItem('q_builder_cached_user', JSON.stringify({ uid: 'ui-fixture', email: 'preview@example.com', displayName: 'Kiểm tra giao diện', emailVerified: true }));
    localStorage.setItem('q_builder_cached_user_doc', JSON.stringify({ status: 'approved', emailVerified: true, phoneNumber: '0901234567', planType: 'free', promptCount: 0 }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:3000');
  const intro = page.locator('#drawing-introduction');
  await intro.waitFor();
  if (await page.getByText('Hạn mức tinh chỉnh AI', { exact: true }).count() !== 1) throw Error('Shared AI quota card missing or duplicated');
  if (await intro.getByRole('link', { name: 'Hướng dẫn sử dụng' }).getAttribute('href') !== '/ve-hinh/huong-dan.html') throw Error('Guide link missing');
  await intro.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'scratch/final-drawing-home-desktop.png', fullPage: true });
  await intro.getByRole('button', { name: 'Mở Vẽ hình', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Vẽ Hình — bảng vẽ tương tác"]');
  await frame.locator('#canvas svg').waitFor();
  await frame.getByRole('button', { name: 'Hướng dẫn sử dụng Vẽ hình', exact: true }).click();
  if (!await frame.locator('#help-dialog').isVisible()) throw Error('Tool guide is inaccessible');
  if (await frame.locator('#help-dialog a').getAttribute('href') !== './huong-dan.html') throw Error('Tool full guide link missing');
  await frame.locator('[data-close="help-dialog"]').click();
  await page.getByRole('button', { name: 'Mở thanh điều hướng Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await intro.scrollIntoViewIfNeeded();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Homepage has horizontal overflow');
  await intro.screenshot({ path: 'scratch/final-drawing-home-mobile.png' });
  await page.goto('http://localhost:3000/ve-hinh/huong-dan.html');
  await page.getByRole('heading', { name: 'Hướng dẫn Vẽ hình', exact: true }).waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Guide has horizontal overflow');
  for (const id of ['start', 'edit', 'view', 'files', 'ai']) if (!await page.locator('#' + id).count()) throw Error('Guide section missing: ' + id);
  await page.screenshot({ path: 'scratch/final-drawing-guide-mobile.png', fullPage: true });
  if (errors.length) throw Error(JSON.stringify(errors));
  return { desktop: '1440x1000', mobile: '390x844', CTA: true, sharedQuotaCard: true, guide: true, errors };
}
