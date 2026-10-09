async page => {
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().route('https://zalo.me/**', route => route.fulfill({ body: '<title>Zalo link test</title>' }));
  const pet = page.getByRole('link', { name: /^Thú cưng Codex/ });
  await pet.waitFor();
  let popups = 0;
  page.on('popup', popup => { popups++; popup.close(); });
  const drag = async () => {
    const b = await pet.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 - 120, b.y + b.height / 2 - 90, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const next = await pet.boundingBox();
    if (Math.abs(next.x - b.x) < 30) throw Error('Mascot drag failed: ' + JSON.stringify({b,next,html:await pet.evaluate(e=>e.parentElement.outerHTML.slice(0,450))}));
  };
  await drag();
  await pet.click();
  await page.waitForTimeout(100);
  if (popups) throw Error('Drag/immediate click opened Zalo');
  await page.waitForTimeout(1100);
  await drag();
  await page.waitForTimeout(1100);
  await pet.click();
  await page.waitForTimeout(100);
  if (popups) throw Error('Repeated drag did not reset cooldown');
  await page.waitForTimeout(1100);
  await pet.click();
  await page.waitForTimeout(200);
  if (popups !== 1) throw Error('Idle click did not open exactly one Zalo link');
  return 'PASS: desktop drag, pointer-up suppression, immediate click blocked, repeated drag resets 2-second cooldown, idle click opens Zalo';
}
