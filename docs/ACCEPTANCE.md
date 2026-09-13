# v0.3 Daily Study Workflow 驗收

2026-09-07，香港時區。基於 `46ecc76d8a2e955dfc71ef2e8a6500319729c16a` 在既有本機專案開發，沿用私人倉庫。**v0.3 本機工程驗收 PASS；真人產品驗證仍未完成。**

本輪測試使用 `study_test`、`study_browser_v03`、`study_upgrade_v03_verify` 及獨立 `dse-study-studio-v03-verify` Compose project。正式 `study` 僅備份、升級與唯讀核對，未插入測試任務。原始證據在本機 `artifacts/v03/`，可能包含私人快照，刻意不提交；GitHub 提交程式、重現腳本與本報告。

## v0.3 A–H

| Gate | 狀態 | 證據與範圍 |
| --- | --- | --- |
| A Quick Capture | PASS（工程） | Today／任務池只填 title 可保存；科目及估時保持 null；保存後清除舊搜尋。詳情可補科目／Topic／估時；未分類亦能開始、停止，首次補估時扣除有效實際時間。`tests.txt`、兩個 `browser-*.json`。 |
| B Quick Reschedule | PASS | 卡片直接今天／明天／本週／下週／未安排；自選日期；已開始任務可改期。相同安排不多寫 PLAN_CHANGED，before/after 正確。FIXED 移日保留時間，移到週移除指定時間。`fixed-quick-move.json`、API tests。 |
| C Fixed + Reminder | PASS（工程） | 一次設定20:00，連結提醒同時建立；改20:30同步；關閉後無連結提醒；離開FIXED撤銷。舊claim失效、相同保存不重建；舊v0.2 FIXED不自動啟用。`fixed-desktop.txt`、browser/API tests。實體手機送達另列NOT_RUN。 |
| D Follow-up | PASS | 完成即保存、下一步可選。新標題＋原科目／Topic，未安排；無舊Session、Review、Reminder、子項、完成狀態及原事件。原Task不變。API及桌面／390px流程。 |
| E Do Again | PASS | 完成詳情／歷史列表建立獨立新任務，保留title／科目／Topic／estimated／is_review；新TODO／UNSCHEDULED，自己的CREATED事件；原Task／Session／Event逐值相同。 |
| F Today | PASS（瀏覽器） | 目前Task、今日學習及少量未安排入口優先；卡片Start／Continue為主要操作；容量圖改為按需展開。直接Start→Pause→部分子項→Resume→Stop→刷新→Continue→Complete。`today-1440.png`、`today-390.png`。 |
| G Reminder → Action | PASS（應用流程） | 保留Task URL；登出狀態開連結→登入→原任務，直接Start／Continue、延後30分鐘、移到明天。`login-action-link.json`。本輪沒有聲稱真機OS通知點擊已測。 |
| H History Search | PASS | 已完成與已取消各35個較新Task，目標不在第一頁仍可從完整資料搜尋；字面%／_及大小寫、無匹配處理通過。390px實際查回第一頁之外的完成Task，`history-search.json`。 |

兩種視窗各 **19個核心流程步驟 PASS**，390px無水平溢出。瀏覽器實際輸入／點擊由CUA執行；日期／時間使用原生鍵盤操作提交，沒有以改React內部狀態替代。測試是短時間操作，不表示真人已達5秒記錄或已學習35分鐘。

## v0.2 回歸與資料保留

- `npm run build` PASS；`npm test` **18/18 PASS**，沒有skip。保留A–J、單一active、Pause不計時、Stop／Continue、子項門檻、跨日、英文Routine、有效時間、完成／取消時間、不可變事件、獨立Review、Auth和Reminder競爭，以及有大量歷史時的state邊界。
- 新增四組API測試覆蓋Quick Capture、Fixed+Reminder、Follow-up／Do Again、跨頁歷史搜尋。未新增CI、架構重構、Migration framework或多裝置Push管理。
- 合成測試備份還原到獨立庫後連續執行兩次migration，所有原有欄位逐行相同，無偽造或回填事件。`upgrade-preservation.json`、`scripts/verify-v03-upgrade.mjs`。
- 實際Docker映像 `311b1331b0e0` 建置成功；隔離容器API驗證401、title-only、連結Reminder、Start／Pause通過。Web重啟後所有表逐行一致，含paused Session、Event、Auth。`docker-build.txt`、`container-smoke.json`、`container-before.json.result.json`。
- 正式服務更新後再核對升級前原有資料；新增欄位以外的原值保持不變。`live-preservation.json`。正式資料備份 `backups/pre-v03.dump` 僅存本機，不提交Git。

## 明確語義與限制

- 未分類Task不產生無科目的Review；Session／實際時間照常保存。補科目後的新Stop／Complete可記Review，過往Review不回填、不代表掌握度。已有科目及Session的Task仍保留v0.2分類保護。
- 未估時表示未知，不虛構30分鐘；容量推算不包含其未知剩餘工作，UI明示限制。首次補預估會扣除累積實際時間；之後原先預估與剩餘估時分開修改。
- 延後30分鐘從現在計，改為手動Reminder、解除到點連結，保留原FIXED時間。快速移日保留FIXED時間／連結選擇；一般改期不移動獨立手動Reminder。使用者有明確設定或開啟才通知。
- v0.2的接收端競爭／重試及OS顯示原子性限制沿用，沒有擴張多裝置管理或provider retry policy。若設定已過的FIXED時間且開啟提醒，會盡快提醒，表單已提示。

## 尚未驗收

| 項目 | 狀態 | 說明 |
| --- | --- | --- |
| 真人約5秒完成Quick Capture | NOT_RUN | 需使用者真實操作計時；自動化不替代。 |
| 真人每日安排速度／數週使用效益 | NOT_RUN | 交付後進入日常使用，依實際摩擦決定後续需求。 |
| Linux私人HTTPS／遠端TLS與存取 | NOT_RUN | 網域尚未決定，本輪未操作Linux主機。 |
| 實體手機背景收到通知→點擊→Task | NOT_RUN | 390px為桌面瀏覽器模擬視窗；不能替代真機背景通知。 |
| Exam／AI／Gamification／CI／Migration framework／多裝置Push | 未實作（按範圍延期） | 不列為本輪工程完成項目。 |

v0.3工程完成與真人產品驗證分開；不以本輪工程通過補簽v0.2仍欠缺的HTTPS／手機背景通知驗收。舊驗收見 [v0.2](ACCEPTANCE_V0.2.md) 與 [v0.1](ACCEPTANCE_V0.1.md)。
