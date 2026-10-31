import { expect, test, devices, type Page } from '@playwright/test';

const phone = devices['Pixel 7'];

async function holeCards(page: Page): Promise<string> {
  const cards = page.getByRole('button', { name: /Hole Cards/ });
  const box = (await cards.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const text = (await cards.innerText()).replace(/\s+/g, ' ').trim();
  await page.mouse.up();
  return text;
}

async function join(page: Page, code: string, name: string, seat: number) {
  await page.goto('/play');
  await page.getByLabel('Game Code').fill(code);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: new RegExp(`^Seat ${seat} `) }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('a Table and two phones play a Hand through to Showdown', async ({ browser }) => {
  const table = await (await browser.newContext()).newPage();
  const ann = await (await browser.newContext(phone)).newPage();
  const bob = await (await browser.newContext(phone)).newPage();

  await table.goto('/table');
  await expect(table).toHaveURL(/code=[A-Z]{4}/);
  const code = new URL(table.url()).searchParams.get('code')!;

  await join(ann, code, 'Ann', 1);
  await join(bob, code, 'Bob', 2);
  await expect(table.getByLabel('Seat 2')).toContainText('Bob');

  await ann.getByRole('button', { name: 'Deal' }).click();
  await expect(ann.getByRole('button', { name: /Hole Cards/ })).toBeVisible();

  const annCards = await holeCards(ann);
  const bobCards = await holeCards(bob);
  const hidden = async () => {
    const tableText = await table.locator('body').innerText();
    const annText = await ann.locator('body').innerText();
    const bobText = await bob.locator('body').innerText();
    for (const card of bobCards.split(' ')) {
      expect(tableText).not.toContain(card);
      expect(annText).not.toContain(card);
    }
    for (const card of annCards.split(' ')) {
      expect(tableText).not.toContain(card);
      expect(bobText).not.toContain(card);
    }
  };

  let reloaded = false;
  for (let step = 0; step < 20; step++) {
    if (await table.getByRole('list', { name: 'Pots' }).getByText(/wins/).first().isVisible()) break;
    await hidden();
    const actor = (await ann.getByRole('heading', { name: 'Your turn' }).isVisible())
      ? ann
      : (await bob.getByRole('heading', { name: 'Your turn' }).isVisible())
        ? bob
        : null;
    if (!actor) {
      await table.waitForTimeout(100);
      continue;
    }
    if (actor === bob && !reloaded) {
      reloaded = true;
      await bob.reload();
      await expect(bob.getByRole('heading', { name: 'Bob' })).toBeVisible();
      expect(await holeCards(bob)).toBe(bobCards);
      await expect(bob.getByRole('heading', { name: 'Your turn' })).toBeVisible();
    }
    await actor.getByRole('button', { name: /^(Check|Call)/ }).click();
  }

  expect(reloaded).toBe(true);
  await expect(table.getByRole('list', { name: 'Pots' }).getByText(/wins/).first()).toBeVisible();
  const chips = await table.getByLabel(/^Seat [12]$/).allInnerTexts();
  const total = chips.map((t) => Number(/(\d+) Chips/.exec(t)![1])).reduce((a, b) => a + b, 0);
  expect(total).toBe(2000);
});
