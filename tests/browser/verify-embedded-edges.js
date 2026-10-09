async page => {
  const frame=page.frameLocator('iframe[title="Vẽ Hình — bảng vẽ tương tác"]');
  await page.locator('iframe').evaluate(el=>new Promise(resolve=>{el.addEventListener('load',()=>resolve(null),{once:true});el.contentWindow.location.reload();}));
  await frame.locator('#canvas svg').waitFor();
  await frame.locator('[data-mode="geometry"]').click();
  const cases=[];
  for(const size of [{width:1600,height:900},{width:1200,height:700},{width:390,height:844}]){
    await page.setViewportSize(size);
    for(const outer of [false,true]){
      const sidebar=page.locator('aside').first();
      const visible=await sidebar.evaluate(e=>e.getBoundingClientRect().left>=0);
      if(visible&&!outer)await sidebar.locator('button').first().click();
      else if(!visible&&outer)await page.getByTitle('Mở thanh điều hướng Menu').click();
      await page.waitForTimeout(350);
      if(size.width<768&&outer){await sidebar.locator('button').first().click();continue;}
      for(const inner of [true,false]){
        if(size.width<768&&inner)continue;
        if(!await frame.locator('#sidebar').isVisible())await frame.locator('#toggle-sidebar').click();
        await frame.locator('#show-tools').click();await frame.locator('[data-tool="region"]').click();
        if(!inner&&await frame.locator('#sidebar').isVisible())await frame.locator('#toggle-sidebar').click();
        const canvas=frame.locator('#canvas');const box=await canvas.boundingBox();
        await page.mouse.move(box.x+4,box.y+4);await page.mouse.down();await page.mouse.move(box.x+box.width-4,box.y+box.height-4);
        const r=await frame.locator('#selection-marquee').boundingBox();await page.mouse.up();
        if(r.x>box.x+6||r.y>box.y+6||r.x+r.width<box.x+box.width-6||r.y+r.height<box.y+box.height-6)throw Error('Embedded edge selection fails: '+JSON.stringify({size,outer,inner,box,r}));
        const iframe=await page.locator('iframe').boundingBox();
        if(Math.abs(iframe.y+iframe.height-size.height)>2)throw Error('Lost full-height embedding');
        const buttons=await frame.locator('.file-actions').boundingBox();if(buttons.y<box.y+box.height-1)throw Error('File buttons not below embedded canvas');
        cases.push({size,outer,inner,box,r});
      }
    }
  }
  await page.waitForTimeout(350);
  await page.screenshot({path:'scratch/drawing-finished-mobile.png'});
  await page.setViewportSize({width:1600,height:900});
  if(!await frame.locator('#sidebar').isVisible())await frame.locator('#toggle-sidebar').click();
  await frame.locator('#show-tools').click();
  await page.waitForTimeout(150);
  await page.screenshot({path:'scratch/drawing-finished-desktop.png'});
  return {cases};
}
