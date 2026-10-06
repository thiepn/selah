import { test, expect } from '@playwright/test';

async function openPassage(page,reference='Phil 2:5-11'){
  await page.goto('/');
  const input=page.getByLabel('Bible reference');
  await input.fill(reference);
  await input.press('Enter');
  await expect(page.locator('#passageStatus')).toContainText(/Philippians 2/);
  await expect(page.locator('#studyContent')).toContainText('PASSAGE GUIDE');
}

test('compact phone keeps primary controls reachable with touch-sized targets',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='compact-phone-chromium');
  await openPassage(page);

  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);

  for(const selector of ['#mobileStudyToggle','#studiesBtn','#reviewBtn','#prevChapterBtn','#nextChapterBtn']){
    const box=await page.locator(selector).boundingBox();
    expect(box,selector).not.toBeNull();
    expect(box.width,selector+' width').toBeGreaterThanOrEqual(44);
    expect(box.height,selector+' height').toBeGreaterThanOrEqual(44);
  }
});

test('touch tablet remains usable without horizontal document overflow',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='tablet-chromium');
  await openPassage(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
  const scripture=await page.locator('#biblePane').boundingBox();
  const study=await page.locator('#studyPane').boundingBox();
  expect(scripture?.width??0).toBeGreaterThanOrEqual(300);
  expect(study?.width??0).toBeGreaterThanOrEqual(280);
});

test('keyboard drawers trap focus, escape closes, and focus returns to opener',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  await openPassage(page);

  const opener=page.getByRole('button',{name:'Studies',exact:true});
  await opener.focus();
  await opener.press('Enter');
  await expect(page.locator('#studiesDrawer')).toBeVisible();
  await expect(page.locator('#studySearch')).toBeFocused();

  const close=page.getByRole('button',{name:'Close studies'});
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#restoreBtn')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#studiesDrawer')).toBeHidden();
  await expect(opener).toBeFocused();
});

test('visible study textareas have programmatic accessible names',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  await openPassage(page);
  await page.getByRole('tab',{name:'Notes'}).click();

  const unnamed=await page.locator('textarea:visible').evaluateAll((nodes)=>nodes.filter((node)=>{
    const id=node.id;
    const labelled=id&&document.querySelector('label[for="'+CSS.escape(id)+'"]');
    return !(node.getAttribute('aria-label')||node.getAttribute('aria-labelledby')||labelled||node.closest('label'));
  }).map((node)=>node.id||node.className));
  expect(unnamed).toEqual([]);
});

test('long study session preserves passage-owned work through repeated navigation',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  await openPassage(page,'Phil 2:5-11');

  await page.getByRole('tab',{name:'Notes'}).click();
  const doc=page.locator('#studyDocument');
  await doc.fill('Observe humility and obedience. [[Philippians 2:12-18]]');
  await expect(page.locator('#saveState')).toContainText(/saved locally|saving/);
  await expect.poll(()=>page.locator('#saveState').textContent()).toContain('saved locally');

  await page.getByRole('tab',{name:'Outline'}).click();
  await page.locator('#outlineNewReference').fill('Phil 2:5-8');
  await page.locator('#outlineNewLabel').fill('Christ humbles himself');
  await page.locator('#outlineAdd').click();
  await expect(page.locator('.outline-section')).toHaveCount(1);

  const reference=page.getByLabel('Bible reference');
  await reference.fill('Phil 2:12-18');
  await reference.press('Enter');
  await expect(page.locator('#passageStatus')).toContainText(/Philippians 2:12/);

  await page.getByRole('tab',{name:'Notes'}).click();
  await page.locator('#studyDocument').fill('Work out the implications with care.');
  await expect.poll(()=>page.locator('#saveState').textContent()).toContain('saved locally');

  await page.locator('#backBtn').click();
  await expect(page.locator('#passageStatus')).toContainText(/Philippians 2:5/);
  await page.getByRole('tab',{name:'Notes'}).click();
  await expect(page.locator('#studyDocument')).toHaveValue(/humility and obedience/);

  await page.getByRole('tab',{name:'Outline'}).click();
  await expect(page.locator('.outline-section')).toHaveCount(1);

  await page.locator('#forwardBtn').click();
  await expect(page.locator('#passageStatus')).toContainText(/Philippians 2:12/);
  await page.getByRole('tab',{name:'Notes'}).click();
  await expect(page.locator('#studyDocument')).toHaveValue(/implications with care/);
});
