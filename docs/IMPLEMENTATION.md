# v0.3 實作語義

工作位置：使用者既有本機 `to do studio`；GitHub為完成本機驗證後的同步目的地。原始v0.2文件中的遠端倉庫是來源基準，不建立第二套開發專案。

## v0.3 增量

- `003-daily-workflow.sql`：Task subject_id／estimated 可空，remaining 仍為數值，未估時以 estimated=null 區分；Topic 不能在無科目時存在。原資料原值不回填。
- Plan.remind_at_start 舊資料預設 false，Reminder.source 預設 manual。Plan 的 AFTER UPDATE trigger 在同一交易替換／撤銷 fixed 提醒，因此開始學習自動轉 DAY 的既有流程也不會留下連結提醒。手動提醒 API 解除到點連結，計劃保持原時間。
- 新選 FIXED 預設提醒 true；原 FIXED 省略選項時保留原選擇。相同安排保存不重建 Reminder、不重複 PLAN_CHANGED；僅切提醒開關不產生假改期事件。
- Quick Capture 仍用 POST /tasks，只需 title；PATCH 一次更新指定欄位，補科目與 Topic 不會因逐欄更新造成中間狀態外鍵錯誤。未分類已開始任務可補科目，已分類且有 Session 的歷史分類保護保持。
- 首次補估時會先保存 live interval，再以有效累積時間計算剩餘，避免重扣；原估時清空時 remaining 歸零但 UI 顯示未估時，實際時間不變。
- POST /tasks/:id/copy：僅已完成 Task 可建立 follow-up／again。交易只插入新 Task 和 UNSCHEDULED Plan，新事件只有自己的 CREATED；原 Task／Session／Event 完全不動。
- Archive search 用參數化的字面子字串比較，先在所有已結束 Task 中篩選，再 LIMIT/OFFSET；搜尋改變重設前端分頁，不把 %／_ 當 wildcard。
- Workflow.tsx 僅封裝共用改期／下一步操作，沿用既有前後端模組與框架；未導入 Migration framework、CI、Exam 或 AI。

## 架構與資料

維持React/Vite、Express、PostgreSQL模組化單體。前端按Today、Tasks、TaskDetail、Planning、Subjects、History/Reviews、Settings/Login拆分；共用API、時間、通知與UI context在 `src/lib`。後端按功能拆分路由及服務，bootstrap不再承擔全部功能。

`server/migrations/002-foundation.sql`以同一migration交易新增欄位、事件、認證表、提醒狀態及索引。舊資料不回填推測完成／取消時間；原欄位原值逐行驗證保留。

## 任務與時間

- 香港日期／星期一起算；五種Planning語義保持不變。
- updated_at只在有效變更更新，包含子項、安排、Session狀態；completed_at/cancelled_at在第一次真正終結轉移記錄。
- Task/Plan/Session trigger與原操作同一交易產生不可變事件；相同安排不產生事件，重複終結API直接保持既有狀態。
- CREATED、PLAN_CHANGED、SESSION_STARTED/PAUSED/RESUMED/STOPPED、COMPLETED、CANCELLED可供時間線查詢；Plan保留before/after，Session事件有session_id。
- Task.actual無來源欄位已移除。有效分鐘由已結束間隔SQL彙總＋目前live間隔計算，active session另帶已結束秒數。今日只用今日部分，不重扣跨日歷史。
- 保留單一active session、Pause不計時、Stop/Continue、子項完成門檻與可修訂剩餘估時。
- 局部Task PATCH會排除未提交欄位，避免Zod的建立預設值覆蓋既有Topic／英文桶／原始估時。

## 按需載入

`/api/state`提供科目、Topic、Routine、未完成任務、當週日安排、今日有活動任務，以及可選的當前Task Detail。不傳全部歷史Session/Interval/Review/Event；只帶active session/live interval與所需任務的數值彙總。

History tasks/reviews各自分頁，預設30、最高50。終結任務查詢也分頁；Subject最近10筆及每個Topic最近一次由伺服器查詢。Today不塞歷史統計。本月完成數只查completed_at。

Review仍是獨立學習活動紀錄，不取代Task Event，不推斷掌握度。

## 登入與部署

單一密碼的scrypt hash只在伺服器環境；隨機token以SHA256 hash持久化於auth_sessions。HttpOnly/SameSite=Strict，HTTPS另外使用Secure和__Host前綴；本機不同埠使用不同cookie名稱避免測試環境互相覆蓋登入。登出撤銷當前token；所有私人API在伺服器驗證，Origin/Fetch-Site僅為額外保護。

Linux使用獨立production Compose＋Caddy HTTPS；只有80/443對外，Web/Postgres沒有發布port。PRIVATE_DEPLOYMENT會拒絕HTTP、示例／短資料庫密碼或缺失登入設定。Linux網域未定，未實際部署。

## 提醒

pending → sending（recipient、claim_token、claimed_at）→ delivered；失敗為error。claim在DB交易內排他，保留recipient以便安全重試；30秒可重試同一claim。Push配置後負責新提醒，先前browser claim仍可由原browser完成，避免切換模式後卡住。

Push provider接受只寫accepted_at；Service Worker確認顯示後才寫delivered_at。失效404/410訂閱清理並释放接收端；提醒修改採新id，完成／取消使未送提醒失效，顯示前重新驗證。

Service Worker串行處理poll/Push，共用IndexedDB收據及notification tag；點擊導向 `/?task=<id>`，需要登入時保留目標。正常競爭／重試已有測試；任意OS崩潰跨顯示與收據存檔的極端exactly-once無法保證，見README。

## 驗收狀態

v0.3 本機工程與真人驗收分列於 ACCEPTANCE；v0.2 歷史結果保留在 ACCEPTANCE_V0.2。Linux HTTPS、實體手機背景通知及真人5秒／長期使用尚未驗收，不以本機視窗或自動化結果替代。
