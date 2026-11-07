import { test, expect } from "@playwright/test";
import { getQuestionById, RULES_VERSION } from "../src/lib/question-engine";
import { scoreAnswer } from "../src/lib/scoring";
async function skipRun(page: import("@playwright/test").Page) {
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Skip this round" }).click();
    await page
      .getByRole("button", {
        name: i === 4 ? "See my results" : "Next round",
        exact: true,
      })
      .click();
  }
}
test("home, answer matching, complete classic flow, history and reload persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Go beyond the main character." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    const questionId = await page
      .locator(".question-panel")
      .getAttribute("data-question-id");
    const q = getQuestionById(questionId!)!;
    expect(q).toBeTruthy();
    if (i === 0) {
      await page
        .getByLabel("YOUR ANSWER", { exact: true })
        .fill("completely unknown answer");
      await page.getByRole("button", { name: "Lock it in" }).click();
      await expect(page.locator("#answer-error")).toContainText("curated set");
      await page.getByRole("button", { name: "Flag this answer" }).click();
      await expect(
        page.getByRole("button", { name: "Saved for local review" }),
      ).toBeDisabled();
    }
    await expect(
      page.locator(".question-footnote .rarity-range"),
    ).toHaveAttribute("aria-label", "All five rarity tiers available");
    const a = q.answers.find(
      (answer) => scoreAnswer(q, answer).rarity === "Legendary",
    )!;
    await page.getByLabel("YOUR ANSWER", { exact: true }).fill(a.name);
    await page.getByRole("button", { name: "Lock it in" }).click();
    await expect(page.locator(".reveal-panel h2")).toHaveText(a.name);
    await expect(page.locator(".reveal-panel>.rarity-badge")).toContainText(
      "Legendary",
    );
    if (i === 0) {
      await page.getByRole("button", { name: "Explore answer set" }).click();
      await expect(
        page.locator(".answer-reveal-grid>div:not(.answer-source-links)"),
      ).toHaveCount(Math.min(12, q.answers.length));
      await page.screenshot({
        path: "test-results/reveal-desktop.png",
        fullPage: true,
        animations: "disabled",
      });
    }
    await page
      .getByRole("button", {
        name: i === 4 ? "See my results" : "Next round",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Certified deep-cut energy." }),
  ).toBeVisible();
  await expect(page.locator(".result-metrics")).toContainText("5/5");
  await page.screenshot({
    path: "test-results/results-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Back to the lobby" }).click();
  await page.reload();
  await page.getByRole("button", { name: "My profile", exact: true }).click();
  await expect(page.locator(".history-list>div")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "1 answer flagged for review" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(page.locator(".table-row")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("timer expires using elapsed wall-clock time, and the round cannot submit twice", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  await page.clock.fastForward(31000);
  await expect(page.locator(".reveal-panel h2")).toHaveText("Time’s up");
  await expect(page.locator(".revealed-score")).toContainText("+0");
  await page.getByRole("button", { name: "Next round", exact: true }).click();
  await expect(page.locator(".round-label")).toContainText("ROUND 02");
  await expect(page.locator(".countdown")).toContainText("30s");
});
test("daily replay uses the same questions and is saved as practice", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Daily challenge", exact: true })
    .click();
  await page.getByRole("button", { name: "Start today’s challenge" }).click();
  const first = await page.locator(".question-panel h1").innerText();
  await skipRun(page);
  await page.getByRole("button", { name: "Back to the lobby" }).click();
  await page.getByRole("button", { name: "Replay today’s challenge" }).click();
  await expect(page.locator(".question-panel h1")).toHaveText(first);
  await skipRun(page);
  const games = await page.evaluate(
    () => JSON.parse(localStorage.getItem("anillion:progress:v1")!).games,
  );
  expect(
    games.filter((g: { mode: string }) => g.mode === "daily"),
  ).toHaveLength(1);
  expect(
    games.filter((g: { mode: string }) => g.mode === "practice"),
  ).toHaveLength(1);
});
test("local party supports two players and ends in an actual ranking", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Gather your party" }).click();
  await page.getByLabel("Player 1 name").fill("Hinata Fan");
  await page.getByLabel("Player 2 name").fill("Shino Enjoyer");
  await page.getByRole("button", { name: "Start local party" }).click();
  await skipRun(page);
  await page.getByRole("button", { name: "Next: Shino Enjoyer" }).click();
  await expect(
    page.getByRole("heading", { name: "Shino Enjoyer, you’re up." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I’m ready", exact: true }).click();
  await skipRun(page);
  await page
    .getByRole("button", { name: "See party rankings", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Bragging rights, awarded." }),
  ).toBeVisible();
  await expect(page.locator(".party-ranking>div")).toHaveCount(2);
});
test("mobile navigation, question search, settings and modal keyboard interaction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "How to play", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Anime collection", exact: true })
    .click();
  await page.getByLabel("Search questions and anime").fill("naruto");
  await expect(page.locator(".collection-card").first()).toBeVisible();
  expect(await page.locator(".collection-card").count()).toBeLessThanOrEqual(
    18,
  );
  await page
    .locator(".collection-card")
    .first()
    .getByRole("button", { name: "Practice", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/question-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Leave game", exact: true })
    .first()
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Leave game", exact: true })
    .click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("DISPLAY NAME").fill("Anime Archivist");
  await page.getByLabel("CLASSIC ROUND TIMER").selectOption("45");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  await expect(page.locator(".countdown")).toContainText("45s");
});

test("anime-title practice validates scope and the collection is paginated with real rarity coverage", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Anime collection", exact: true })
    .click();
  await page.getByRole("button", { name: "Anime titles", exact: true }).click();
  await page.screenshot({
    path: "test-results/engine-collection-desktop.png",
    animations: "disabled",
  });
  await expect(page.locator(".collection-card")).toHaveCount(18);
  const first = await page.locator(".collection-card h3").first().innerText();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".collection-card h3").first()).not.toHaveText(
    first,
  );
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Search questions and anime").fill("first aired");
  await page
    .locator(".collection-card")
    .first()
    .getByRole("button", { name: "Practice", exact: true })
    .click();
  const id = await page
    .locator(".question-panel")
    .getAttribute("data-question-id");
  const q = getQuestionById(id!)!;
  expect(q.answerKind).toBe("anime");
  const { ANIME } = await import("../src/data/anime");
  const outside = ANIME.find((a) => !q.answers.some((x) => x.id === a.id))!;
  await page.getByLabel("YOUR ANSWER", { exact: true }).fill(outside.name);
  await page.getByRole("button", { name: "Lock it in" }).click();
  await expect(page.locator("#answer-error")).toContainText(
    "doesn’t fit this question",
  );
  const legendary = q.answers.find(
    (a) => scoreAnswer(q, a).rarity === "Legendary",
  )!;
  await page.getByLabel("YOUR ANSWER", { exact: true }).fill(legendary.name);
  await page.keyboard.press("Enter");
  await expect(page.locator(".reveal-panel h2")).toHaveText(legendary.name);
  await expect(page.locator(".reveal-panel>.rarity-badge")).toContainText(
    "Legendary",
  );
  await page.getByRole("button", { name: "Explore answer set" }).click();
  await expect(
    page.locator(".answer-reveal-grid>div:not(.answer-source-links)"),
  ).toHaveCount(Math.min(12, q.answers.length));
  await page
    .getByRole("button", {
      name: `Legendary (${q.coverage.Legendary})`,
      exact: true,
    })
    .click();
  await expect(page.locator(".answer-reveal-grid>div")).toHaveCount(
    Math.min(12, q.coverage.Legendary),
  );
  await page.screenshot({
    path: "test-results/engine-anime-reveal.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "See my results" }).click();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("anillion:progress:v1")!).games[0],
  );
  expect(saved.rulesVersion).toBe(RULES_VERSION);
  expect(saved.rounds[0].scopeKey).toBe(q.scopeKey);
  expect(saved.rounds[0].questionPrompt).toBe(q.prompt);
});

test("completed classic runs influence the next run without changing the daily challenge", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s play", exact: true }).click();
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    seen.push(
      (await page.locator(".question-panel").getAttribute("data-question-id"))!,
    );
    await page.getByRole("button", { name: "Skip this round" }).click();
    await page
      .getByRole("button", {
        name: i === 4 ? "See my results" : "Next round",
        exact: true,
      })
      .click();
  }
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    expect(seen).not.toContain(
      await page.locator(".question-panel").getAttribute("data-question-id"),
    );
    await page.getByRole("button", { name: "Skip this round" }).click();
    await page
      .getByRole("button", {
        name: i === 4 ? "See my results" : "Next round",
        exact: true,
      })
      .click();
  }
});

test("old local daily history is retained and does not block the new rules version", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "anillion:progress:v1",
      JSON.stringify({
        version: 1,
        games: [
          {
            id: "legacy-daily",
            date: new Date().toISOString(),
            mode: "daily",
            dailyKey: new Date().toISOString().slice(0, 10),
            total: 100,
            rounds: [],
            player: "Returning fan",
          },
        ],
        settings: {
          player: "Returning fan",
          roundSeconds: 30,
          sound: false,
          reducedMotion: true,
        },
        reviews: [],
      }),
    );
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Daily challenge", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start today’s challenge" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start today’s challenge" }).click();
  await skipRun(page);
  const games = await page.evaluate(
    () => JSON.parse(localStorage.getItem("anillion:progress:v1")!).games,
  );
  expect(games).toHaveLength(2);
  expect(
    games.find((g: { id: string }) => g.id === "legacy-daily"),
  ).toBeTruthy();
  expect(games[0].mode).toBe("daily");
  expect(games[0].rulesVersion).toBe(RULES_VERSION);
});
