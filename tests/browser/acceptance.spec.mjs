import { test, expect } from '@playwright/test';

async function openPhilippians(page){
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'What are you studying?'})).toBeVisible();
  const reference=page.getByLabel('Bible reference');
  await reference.fill('Phil 2:5-11');
  await reference.press('Enter');
  await expect(page.locator('#passageStatus')).toContainText(/Philippians 2:5/);
  await expect(page.locator('#studyContent')).toContainText('PASSAGE GUIDE');
}

test('compiled overlap helper keeps its browser contract',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const study=await import('./core/study/index.js');
    const refs=await import('./core/domain/references/index.js');
    return study.studiesOverlappingPassage([],refs.parseReference('Phil 2:5-11').passage);
  });
  expect(Array.isArray(result)).toBe(true);
});

test('desktop study flow persists a saved observation and exposes the resulting study',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  await openPhilippians(page);

  await page.locator('[data-observation-save]').first().click();
  await expect(page.locator('#toast')).toContainText('Observation question saved');

  await page.getByRole('button',{name:'Studies'}).click();
  await expect(page.locator('#studiesDrawer')).toBeVisible();
  await expect(page.locator('#studiesList')).toContainText(/Philippians 2:5/);
  await page.getByRole('button',{name:'Close studies'}).click();

  await page.reload();
  await expect(page.locator('#passageStatus')).toContainText(/Philippians 2:5/);
  await page.getByRole('tab',{name:'Notes'}).click();
  await expect(page.locator('#studyContent')).toContainText(/question/i);
});

test('mobile layout has no document overflow and study tools remain operable',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile-chromium');
  await openPhilippians(page);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const toggle=page.locator('#mobileStudyToggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');

  await page.getByRole('tab',{name:'Notes'}).click();
  await expect(page.locator('#studyContent')).toContainText('STUDY DOCUMENT');
  await expect(page.locator('#studyPane')).toHaveClass(/open/);
});

test('PWA registers a service worker, exposes install metadata, and restores the studied passage offline',async({page,context},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium');
  await openPhilippians(page);

  const manifest=await page.evaluate(async()=>{
    const link=document.querySelector('link[rel="manifest"]');
    const response=await fetch(link.href);
    return response.json();
  });
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  expect(manifest.icons?.some((icon)=>String(icon.sizes).includes('192x192')||icon.sizes==='any')).toBeTruthy();
  expect(manifest.icons?.some((icon)=>String(icon.sizes).includes('512x512')||icon.sizes==='any')).toBeTruthy();

  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#passageStatus')).toContainText(/Philippians 2:5/);
  await expect(page.locator('#scripture')).toContainText(/Christ|God|Jesus/i);
  await context.setOffline(false);
});
