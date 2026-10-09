async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const pet = page.getByRole('link', { name: /^Thú cưng Codex/ }); await pet.waitFor();
  let popups = 0; page.on('popup', p => { popups++; p.close(); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const b = await pet.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 80, y: y - 70 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(350);
  const next = await pet.boundingBox();
  if (Math.abs(next.x - b.x) < 30) throw Error('Touch drag failed');
  await pet.click(); await page.waitForTimeout(100);
  if (popups) throw Error('Cancel/immediate click opened Zalo');
  const point = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x - 30, point.y - 30); await page.mouse.up();
  await page.waitForTimeout(350);
  const mouse = await pet.boundingBox();
  if (Math.abs(mouse.x - next.x) < 15) throw Error('Cancel left pointer stuck');
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp.detach();
  return 'PASS: emulated touch drag, pointercancel blocks click, capture released and next mouse drag works';
}
