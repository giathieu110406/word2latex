async page => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://localhost:3000/ve-hinh/index.html');
  await page.locator('#canvas svg').waitFor();
  await page.locator('[data-tool="region"]').click();
  await page.locator('#toggle-sidebar').click();
  const canvas = page.locator('#canvas');
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + 4, b.y + 4); await page.mouse.down();
  await page.mouse.move(b.x + b.width - 4, b.y + b.height - 4);
  const marquee = await page.locator('#selection-marquee').boundingBox();
  await page.mouse.up();
  if (marquee.x > b.x + 6 || marquee.y > b.y + 6 || marquee.x + marquee.width < b.x + b.width - 6 || marquee.y + marquee.height < b.y + b.height - 6) throw Error('Marquee does not reach canvas edges: ' + JSON.stringify({b, marquee}));
  const save = await page.locator('#save').boundingBox();
  if (save.y < b.y + b.height) throw Error('File actions still above canvas');
  const grid = await canvas.evaluate(el => getComputedStyle(el).backgroundImage);
  if (!grid.includes('radial-gradient')) throw Error('Grid does not cover the canvas background');
  const choose = async tool => {
    if (!await page.locator('#sidebar').isVisible()) await page.locator('#toggle-sidebar').click();
    await page.locator('#show-tools').click();
    await page.locator(`[data-tool="${tool}"]`).click();
    if (await page.locator('#sidebar').isVisible()) await page.locator('#toggle-sidebar').click();
  };
  const cases = [];
  for (const size of [{width:1600,height:900},{width:600,height:1000},{width:2200,height:850},{width:390,height:844}]) {
    await page.setViewportSize(size); await page.locator('#reset-view').click();
    await choose('point');
    const board = await canvas.boundingBox();
    for (const [x,y] of [[28,28],[board.width-28,28],[28,board.height-28],[board.width-28,board.height-28]]) await canvas.click({position:{x,y}});
    await choose('region'); const box = await canvas.boundingBox();
    await page.mouse.move(box.x+4,box.y+4); await page.mouse.down(); await page.mouse.move(box.x+box.width-4,box.y+box.height-4);
    const r = await page.locator('#selection-marquee').boundingBox(); await page.mouse.up();
    if (r.x > box.x+6 || r.y > box.y+6 || r.x+r.width < box.x+box.width-6 || r.y+r.height < box.y+box.height-6) throw Error('Edges fail after resize: '+JSON.stringify({size,box,r}));
    if (await page.locator('[data-point] circle[stroke="#b07519"]').count() < 4) throw Error('Corner points outside original viewBox cannot be selected');
    const position = await canvas.evaluate(el => getComputedStyle(el).backgroundPosition);
    const step = await canvas.evaluate(el => parseFloat(getComputedStyle(el).backgroundSize));
    await page.locator('#zoom-in').click();
    const zoomStep = await canvas.evaluate(el => parseFloat(getComputedStyle(el).backgroundSize));
    if (Math.abs(zoomStep / step - 1.2) > 0.01) throw Error('Grid does not follow zoom');
    await page.locator('#reset-view').click(); await choose('pan');
    const pb = await canvas.boundingBox();
    await page.mouse.move(pb.x+pb.width/2,pb.y+pb.height/2); await page.mouse.down(); await page.mouse.move(pb.x+pb.width/2+45,pb.y+pb.height/2+30); await page.mouse.up();
    const panPosition = await canvas.evaluate(el => getComputedStyle(el).backgroundPosition);
    if (panPosition === position) throw Error('Grid does not follow pan');
    await page.locator('#reset-view').click();
    const buttons = await page.locator('.file-actions').boundingBox(), cb = await canvas.boundingBox();
    if (buttons.y < cb.y+cb.height-1 || buttons.x < 0 || buttons.x+buttons.width > size.width+1) throw Error('File controls not below canvas or off screen');
    cases.push({size,board:cb,step,zoomStep,panPosition});
  }
  const jsonPromise=page.waitForEvent('download');await page.locator('#save').click();const json=await jsonPromise;await json.saveAs('scratch/edge-drawing.json');
  await page.locator('#document-file').setInputFiles('scratch/edge-drawing.json');
  await page.locator('#export').click();const svgPromise=page.waitForEvent('download');await page.locator('#export-svg').click();const svg=await svgPromise;await svg.saveAs('scratch/edge-drawing.svg');
  await page.locator('#export').click();const pngPromise=page.waitForEvent('download');await page.locator('#export-png').click();const png=await pngPromise;await png.saveAs('scratch/edge-drawing.png');
  await page.screenshot({path:'scratch/drawing-edges-mobile.png'});
  await page.setViewportSize({width:1600,height:900});await page.locator('#reset-view').click();await page.screenshot({path:'scratch/drawing-edges-desktop.png'});
  if(errors.length)throw Error(errors.join(';'));
  return {cases, downloads:[json.suggestedFilename(),svg.suggestedFilename(),png.suggestedFilename()], errors};
}
