const { test, expect } = require('@playwright/test');
const schedule = require('../schedule.json');

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

test('loads Heaven schedule, links profiles, and filters by work date', async ({ page }) => {
  const riaDate = schedule.dates.find(day =>
    (schedule.castsByDate[day.date] || []).some(cast => cast.girlId === '47844108')
  );

  await page.goto('/');
  await expect(page.locator('#scheduleMeta')).toContainText('出勤同期');
  await expect(page.locator('#tbody tr[data-name="Ria/りあ"] td:nth-child(2) a')).toHaveAttribute(
    'href',
    /girlid-47844108/
  );

  await page.locator('#scheduleBtns .fbtn').filter({ hasText: riaDate.label }).click();
  await expect(page.locator('#stats')).not.toContainText('235 / 235名');
  await expect(page.locator('#tbody tr[data-name="Ria/りあ"]')).not.toHaveClass(/hidden/);
  await expect(page.locator('#tbody tr[data-name="Ria/りあ"] .schedule-time')).toContainText('～');
});

test('display adjusters update background and text scale', async ({ page }) => {
  await page.goto('/');

  await page.locator('#colorAdjust').evaluate(input => {
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-color-level', '2');
  await expect(page.locator('#colorAdjustValue')).toHaveText('くっきり');

  await page.locator('#fontAdjust').evaluate(input => {
    input.value = '115';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#fontAdjustValue')).toHaveText('115%');
  await expect(page.locator('html')).toHaveAttribute('style', /--font-scale: 1.15/);
  await expect(page.getByRole('button', { name: '同期する' })).toBeVisible();
});

test('manual editor updates profile links and adds a new cast locally', async ({ page }) => {
  await page.goto('/');

  await page.locator('#castSelect').selectOption({ label: '初代LV・咲蘭/さらん' });
  await page.locator('#editProfileUrl').fill('https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/girlid-test/');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('#tbody tr').first().locator('td').nth(1).locator('a')).toHaveAttribute(
    'href',
    'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/girlid-test/'
  );

  await page.getByRole('button', { name: '新規追加' }).click();
  await page.locator('#editName').fill('テスト新人/てすと');
  await page.locator('#editProfileUrl').fill('https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/girlid-new/');
  await page.locator('#editPrice60').fill('30,000円');
  await page.locator('#editPrice90').fill('45,000円');
  await page.locator('#editPrice120').fill('60,000円');
  await page.locator('#editOpts').fill('電マ,外国人⚪︎');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.locator('#tbody tr')).toHaveCount(236);
  await expect(page.locator('#stats')).toContainText('236 / 236名');
  await expect(page.locator('#tbody tr[data-name="テスト新人/てすと"] td:nth-child(2) a')).toHaveAttribute(
    'href',
    'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/girlid-new/'
  );

  await page.reload();
  await expect(page.locator('#tbody tr[data-name="テスト新人/てすと"]')).toHaveCount(1);
  await expect(page.locator('#tbody tr').first().locator('td').nth(1).locator('a')).toHaveAttribute(
    'href',
    'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/girlid-test/'
  );
});

test('manual editor works even when CSS.escape is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.CSS) window.CSS.escape = undefined;
  });
  await page.goto('/');

  await page.locator('#castSelect').selectOption({ label: 'Ria/りあ' });
  await expect(page.locator('#editName')).toHaveValue('Ria/りあ');

  await page.locator('#editProfileUrl').fill('https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/girlid-no-css-escape/');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('#tbody tr[data-name="Ria/りあ"] td:nth-child(2) a')).toHaveAttribute(
    'href',
    'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/girlid-no-css-escape/'
  );
});
