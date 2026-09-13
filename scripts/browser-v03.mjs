// Run with the authorized CUA tab on the isolated localhost:4319 database.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
export async function workflow({ tab, browser, width, output }) {
  assert.equal(
    await tab.playwright.evaluate(() => location.origin),
    "http://localhost:4319",
  );
  const evidence = { width, startedAt: new Date().toISOString(), steps: [] };
  const b = (name) =>
    name === "今天"
      ? tab.playwright
          .getByRole("navigation", { name: "主導覽", exact: true })
          .getByRole("button", { name, exact: true })
      : tab.playwright.getByRole("button", { name, exact: true });
  const d = () =>
    tab.playwright.getByRole("region", { name: "任務詳情", exact: true });
  const record = async (name) => {
    const dom = await tab.playwright.domSnapshot();
    assert.ok(!dom.includes("- alert:"), dom);
    evidence.steps.push({ name, dom });
  };
  await mkdir(output, { recursive: true });
  await (
    await browser.capabilities.get("viewport")
  ).set({ width, height: 900 });
  await b("今天").click();
  await b("新增任務").click();
  const title = `v03-browser-${width}-${Date.now()}`;
  evidence.title = title;
  await tab.playwright
    .getByRole("textbox", { name: "要做什麼？", exact: true })
    .fill(title);
  await record("title-only-capture");
  await b("儲存任務").click();
  await b("從任務池選擇").click();
  await tab.playwright
    .getByRole("textbox", { name: "搜尋任務", exact: true })
    .fill("");
  const card = () =>
    tab.playwright.getByRole("article").filter({ hasText: title });
  assert.ok((await card().innerText()).includes("未估時"));
  assert.ok((await card().innerText()).includes("未分類"));
  await card().getByText("改期", { exact: true }).click();
  for (const label of ["明天", "本週", "下週", "取消安排", "今天"]) {
    await card().getByRole("button", { name: label, exact: true }).click();
    await record("quick-move-" + label);
  }
  await b(title).click();
  await d().getByText("編輯內容", { exact: true }).click();
  await d()
    .getByRole("combobox", { name: "科目", exact: true })
    .selectOption({ label: "Chinese" });
  await d()
    .getByRole("combobox", { name: "Topic", exact: true })
    .selectOption({ label: "Writing" });
  await d()
    .getByRole("spinbutton", { name: "預估分鐘", exact: true })
    .fill("60");
  await b("儲存內容").click();
  await record("fill-classification-and-estimate");
  await d()
    .getByRole("combobox", { name: "安排層級", exact: true })
    .selectOption({ label: "指定時間" });
  // Native keyboard input is necessary for this CUA runtime's date/time fields.
  await d()
    .getByRole("textbox", { name: "日期", exact: true })
    .fill("2030-10-01");
  await d()
    .getByRole("textbox", { name: "日期", exact: true })
    .press("ArrowUp");
  await d().getByRole("textbox", { name: "時間", exact: true }).fill("19:00");
  await d()
    .getByRole("textbox", { name: "時間", exact: true })
    .press("ArrowUp");
  await b("儲存安排").click();
  assert.ok((await d().innerText()).includes("20:00（香港時間）"));
  await record("fixed-default-linked");
  await d().getByRole("textbox", { name: "時間", exact: true }).fill("19:30");
  await d()
    .getByRole("textbox", { name: "時間", exact: true })
    .press("ArrowUp");
  await b("儲存安排").click();
  assert.ok((await d().innerText()).includes("20:30（香港時間）"));
  await record("fixed-time-updates-reminder");
  await d()
    .getByRole("checkbox", { name: "到這個時間提醒我", exact: true })
    .uncheck();
  await b("儲存安排").click();
  assert.ok((await d().innerText()).includes("只有設定後才通知"));
  await record("fixed-opt-out");
  await d()
    .getByRole("checkbox", { name: "到這個時間提醒我", exact: true })
    .check();
  await b("儲存安排").click();
  await d()
    .getByRole("combobox", { name: "安排層級", exact: true })
    .selectOption({ label: "某一天" });
  await b("儲存安排").click();
  assert.ok((await d().innerText()).includes("只有設定後才通知"));
  await record("fixed-removed");
  await b("延後 30 分鐘").click();
  await b("移到明天").click();
  await record("reminder-shortcuts");
  await b("選入今天").click();
  for (const name of ["閱讀", "練習"]) {
    await d()
      .getByRole("textbox", { name: "新增子項", exact: true })
      .fill(name);
    await d().getByRole("button", { name: "加入", exact: true }).click();
  }
  await b("關閉任務詳情").click();
  await b("今天").click();
  await record("today-execution-first");
  await writeFile(`${output}/today-${width}.png`, await tab.getScreenshot());
  await card().getByRole("button", { name: "開始", exact: true }).click();
  await record("start-from-today");
  await b(title).click();
  await d().getByRole("button", { name: "暫停", exact: true }).click();
  await d().getByRole("checkbox", { name: "閱讀", exact: true }).check();
  await record("paused-partial");
  await d().getByRole("button", { name: "恢復", exact: true }).click();
  await d().getByRole("button", { name: "暫時停止", exact: true }).click();
  await tab.reload();
  await record("reload-stopped-session");
  await b("繼續學習").click();
  await d().getByRole("checkbox", { name: "練習", exact: true }).check();
  await b("完成任務").click();
  await record("completed-with-optional-next-step");
  await d().getByRole("button", { name: "新增後續任務", exact: true }).click();
  await d()
    .getByRole("textbox", { name: "下一步要做什麼？", exact: true })
    .fill(title + " follow-up");
  await b("儲存後續任務").click();
  await record("follow-up-created");
  assert.ok((await d().innerText()).includes("Chinese · 待開始"));
  await b("關閉任務詳情").click();
  await b("從任務池選擇").click();
  await b("已完成").click();
  await tab.playwright
    .getByRole("textbox", { name: "搜尋任務", exact: true })
    .fill(title);
  await card().getByRole("button", { name: "再做一次", exact: true }).click();
  await record("do-again-from-archive");
  assert.ok((await d().innerText()).includes("60 分鐘"));
  const viewport = await tab.playwright.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(viewport.width, width);
  assert.ok(viewport.scrollWidth <= width);
  evidence.viewport = viewport;
  evidence.status = "PASS";
  evidence.finishedAt = new Date().toISOString();
  await writeFile(
    `${output}/browser-${width}.json`,
    JSON.stringify(evidence, null, 2),
  );
  return { status: "PASS", width, title, steps: evidence.steps.length };
}
