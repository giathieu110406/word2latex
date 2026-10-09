async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const usePlan = async expiresAt => {
    await page.addInitScript(value => {
      localStorage.setItem('q_builder_cached_user_doc', JSON.stringify({ status: 'approved', emailVerified: true, phoneNumber: '0901234567', planType: 'pro', planExpiresAt: value }));
    }, expiresAt);
    await page.reload();
  };
  await usePlan(Date.now() + 86400000);
  const subscription = page.getByRole('button', { name: /Gói đăng ký/ }).first();
  await subscription.waitFor(); await subscription.click();
  await page.getByText(/Gói PRO đã đăng ký đến/).waitFor();
  await page.screenshot({ path: 'scratch/subscription-pro.png' });
  await usePlan(Date.now() - 86400000);
  await page.getByRole('button', { name: /Nâng cấp PRO/ }).first().waitFor();
  if (await page.getByRole('button', { name: /Gói đăng ký/ }).count()) throw Error('Expired Pro still shown as active');
  return 'PASS: active Pro shows Gói đăng ký and opens current plan/expiry; expired Pro shows upgrade';
}
