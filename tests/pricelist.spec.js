const { test, expect } = require('@playwright/test');

test('renames the first cast from sara to saran in table and mobile card views', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#tbody tr').first().locator('td').nth(1)).toHaveText('初代LV・咲蘭/さらん');

  await page.getByRole('button', { name: 'スマホ' }).click();
  await expect(page.locator('.girl-card').first().locator('.card-name')).toHaveText('初代LV・咲蘭/さらん');
});

test('right-clicking a cast name opens a delete action that removes the cast after confirmation', async ({ page }) => {
  await page.goto('/');

  page.on('dialog', async dialog => {
    expect(dialog.message()).toContain('本当に削除しますか？');
    await dialog.accept();
  });

  await page.locator('#tbody tr').first().locator('td').nth(1).click({ button: 'right' });
  await page.getByRole('button', { name: '削除' }).click();

  await expect(page.locator('#tbody tr')).toHaveCount(234);
  await expect(page.locator('#stats')).toContainText('234 / 234名');

  await page.getByRole('button', { name: 'スマホ' }).click();
  await expect(page.locator('.girl-card')).toHaveCount(234);
  await expect(page.locator('.girl-card').first().locator('.card-name')).not.toHaveText('初代LV・咲蘭/さらん');
});

test('filters casts by foreign guest support tags', async ({ page }) => {
  await page.goto('/');

  await page.locator('#filterBtns .fbtn').filter({ hasText: '外国人⚪︎' }).click();
  await expect(page.locator('#stats')).toContainText('57 / 235名');
  await expect(page.locator('#tbody tr:not(.hidden)').first().locator('td').nth(1)).toHaveText('初代LV・咲蘭/さらん');
  await expect(page.locator('#tbody tr[data-name="彩羽/いろは"]')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tbody tr[data-name="心/こころ"]')).toHaveClass(/hidden/);

  await page.getByRole('button', { name: 'リセット' }).click();
  await page.locator('#filterBtns .fbtn').filter({ hasText: '外国人△（アジアのみ）' }).click();
  await expect(page.locator('#stats')).toContainText('3 / 235名');
  await expect(page.locator('#tbody tr:not(.hidden)').locator('td:nth-child(2)')).toHaveText([
    'Ria/りあ',
    '如月りのん',
    '純粋/ぴゅあ',
  ]);

  await page.getByRole('button', { name: 'リセット' }).click();
  await page.locator('#filterBtns .fbtn').filter({ hasText: '外国人△（日本語可）' }).click();
  await expect(page.locator('#stats')).toContainText('9 / 235名');
  await expect(page.locator('#tbody tr[data-name="王妃瑠璃/おうひるり"]')).not.toHaveClass(/hidden/);
});
