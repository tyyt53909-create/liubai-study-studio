# MVP 驗收紀錄

日期：2026-09-07（香港）。結論：**本機工程 MVP PASS，可開始個人試用**。

GitHub版本保留此驗收報告及重現脚本；下方 `artifacts/` 原始證據、測試快照與資料庫備份只保存在本機，不隨程式上傳，因此倉庫中的這些相對連結不會包含附件。

需求基線為原始 Task Brief、Project Plan，以及本次目標模式的8組交付標準。採用 React / Express 模組化單體及 PostgreSQL，保留原需求的語義和操作邊界。未公開部署。

## A–J 功能

|任務書驗收|結果|實際證據|
|---|---|---|
|A Task Capture|PASS|真實瀏覽器新增未安排任務；API 證明 Topic / Note / Reminder 非必填。|
|B Planning|PASS|API 逐一保存 UNSCHEDULED / MONTH / WEEK / DAY / FIXED；日期邊界測試；兩種尺寸實際本週→今天改期。取消狀態及刪除提醒亦已測。|
|C Daily Capacity|PASS|120自由容量：40+60=100、餘20；再加30超額10。有效時間與剩餘工作分别計算。|
|D Partial Completion|PASS|API 三子項只完成兩個時拒絕 Complete；瀏覽器刷新保留已勾選子項和未完成狀態。|
|E Stop / Continue|PASS|真實 PostgreSQL 寫入35分鐘測試間隔；60分鐘任務 Stop 後 actual≥35、IN_PROGRESS、可修訂 remaining；Pause、重複請求、跨日及恢復已驗。|
|F Estimated / Actual|PASS|40預估/27實際節省13，當日可用時間更新；53實際超時13亦測；理論完成時間尊重固定時刻並提示碰撞。|
|G Review Memory|PASS|9/1 Writing、9/5 Classical 測試確認 Chinese 最近9/5、Writing仍9/1。API 手動獨立紀錄、非複習任務不自動記、每Session僅一筆；瀏覽器完成後在Chinese/Writing查回。|
|H Routine|PASS|平日120英文+120自由，Routine獨立於Task；重複啟動同日只產生一個Routine任務。自訂英文40後只補80，合計仍120。|
|I Unscheduled|PASS|Today未安排入口、任務池和科目未完成清單；兩種尺寸完整流程可找到無日期任務。|
|J Reminder|PASS（支援的開頁環境）|Chrome localhost 權限granted，Service Worker真實原生Notification清單包含設定任務，見下方。普通任務不建立Reminder，取消移除提醒；不以API ack代替到達證據。|

自動化結果：[tests.txt](../artifacts/tests.txt)，9/9通過。測試內容位於 [domain.test.ts](../tests/domain.test.ts)、[api.test.ts](../tests/api.test.ts)。35／27／53分鐘使用明確控制的測試資料與時間間隔，不代表真人讀書35分鐘；瀏覽器Session則使用真實短時間操作。

## 完整流程與介面

兩次均在最終應用映像 `sha256:5e31eb59a4cd8f037d842a84675b9af38e7108ccb8788855cef2938fd9047029` 上經 CUA 操作真實瀏覽器：

新增無日期任務 → 任務池 → 本週 → 選入今天及容量 → 開始 → 暫停 → 勾選2/3 → 恢復 → 暫時停止 → 刷新確認部分完成 → 繼續 → 勾選最後子項 → 完成 → Chinese / Writing複習。

|尺寸|結果|證據|
|---|---|---|
|1440px桌面|PASS|[逐步DOM與視窗量測](../artifacts/e2e-1440.json)、[桌面實拍](../artifacts/desktop-today.png)|
|390px手機視窗|PASS|[逐步DOM與視窗量測](../artifacts/e2e-390.json)、[手機實拍](../artifacts/mobile-today.png)|

兩種寬度 document.scrollWidth 不超過視窗，核心操作可點擊，不依賴hover。桌面截圖使用 Chrome 既有110%縮放，輸出1584px影像對應約1440 CSS視窗；E2E本身另有1440px確切量測。手機是桌面瀏覽器的390px視窗，不宣稱實體手機驗收。

## 實際通知

- 真正提醒時間：2026-09-07 20:21:50 香港時間。
- 任務：`驗收・實際通知到達`；Reminder ID：`44aa8f2e-d7d5-4beb-9dc5-1b29245f8fda`。
- Chrome已允許通知；從 `navigator.serviceWorker.ready → getNotifications()` 讀到真正 Notification，標題 `讀書提醒 · 驗收・實際通知到達`、對應taskId及唯一tag皆一致。
- 原始瀏覽器結果：[notification-delivery.json](../artifacts/notification-delivery.json)。這是原生通知物件，不是mock或伺服器排程日誌。未拍得macOS桌面橫額，故不聲稱系統橫額有展示。
- 開頁本機通知 PASS；未配置VAPID的關頁背景推送 NOT_RUN；Codex內建瀏覽器通知權限被拒絕。支援條件及操作見README。

## 持久化、Docker與備份

|項目|結果|證據|
|---|---|---|
|實際image build / Compose up / schema初始化|PASS|[Docker build](../artifacts/docker-build.txt)、[運行與health狀態](../artifacts/docker-status.jsonl)|
|Web及PostgreSQL正常重啟|PASS|[重啟前完整快照](../artifacts/restart-before.json)、[逐欄位一致結果](../artifacts/restart-result.json)。比對包括Tasks/Subtasks/Plans/Sessions/Intervals/Reviews/Routine/Reminders，僅排除回應時鐘。|
|暫停中Session及待發提醒重啟恢復|PASS|[session-recovery.json](../artifacts/session-recovery.json)。暫停、已完成部分子項和未到期提醒保留；恢復後恰好多一個有效間隔，Stop後仍IN_PROGRESS。|
|實際pg_dump與獨立庫還原|PASS|[backup-restore.json](../artifacts/backup-restore.json)。11張表所有行與原庫相等；[測試資料備份](../artifacts/acceptance-backup.dump)。未覆蓋正式資料庫。|

資料存於獨立 `dse-study-studio_study-data`，Web4317、PostgreSQL55439只對本機。測試使用獨立 `study_test`；還原使用獨立 `study_restore_verify`。開發期間OneDrive依賴讀取停頓以本機runtime鏡像處理；不需要變更使用者其他項目。

最後已匯出測試快照，按精確ID清除本輪6個測試任務及相關Session/Review，保留科目、Topic與Routine，正式學習歷史從空白開始。見 [fixture-cleanup.json](../artifacts/fixture-cleanup.json) 與 [fixtures-final.json](../artifacts/fixtures-final.json)。驗收備份仍是清理前的測試資料，不應當作個人真實學習紀錄。

## 已修正與仍待測

驗證期間修正了表單隨計時更新失焦、手機詳情開啟位置、子項排序、資料快照排序SQL、英文Routine重複計入、開始任務當日安排及舊回應覆蓋新狀態。最終API、計算、兩尺寸完整流程和重啟驗證已通過，沒有已知會阻斷上述核心流程或造成資料遺失／重複計時的缺陷。

|項目|狀態與測量方式|
|---|---|
|真人普通新增約5秒|NOT_RUN。從按新增到儲存成功，使用5個正常名稱／科目任務，記錄中位數與最慢值；不把自動化毫秒數當真人成績。|
|典型每日安排≤3分鐘|NOT_RUN。從打開Today到選完實際當日任務、確認容量；連續5天記錄，不預先填好資料冒充測量。|
|實體手機瀏覽器|NOT_RUN。需實際裝置與HTTPS存取環境；此次390px視窗已驗收。|
|數週效益|NOT_RUN。個人試用後觀察能否少重複輸入、準確續接和找回複習。工程交付不等待數週。|
|公開部署／多人／登入|不在此次本機MVP範圍。|
|關頁背景Web Push|NOT_RUN，可選VAPID路徑尚未配置及實測；此次提醒驗收限已證實的Chrome開頁路徑。|

完成必要驗證後停止；不新增AI排程、完整日曆、筆記平台或其他MVP外功能。
