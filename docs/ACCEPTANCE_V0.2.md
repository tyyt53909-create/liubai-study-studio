# v0.2 驗收紀錄

2026-09-07，香港時區。**本機工程項目已通過；v0.2整體驗收未完成。** 使用者已指定Linux主機為未來部署位置，但網域尚未決定，故HTTPS私人部署／實體手機背景通知保留NOT_RUN，不以桌面模擬替代。

開發在既有本機專案進行；本機驗證後同步GitHub。下方artifacts是本機原始證據，包含測試資料／快照／備份，刻意不提交Git；GitHub保留本報告、程式與重現測試。

## 本機工程驗收

|項目|狀態|證據與範圍|
|---|---|---|
|Task timestamps / events|PASS|新建唯一CREATED；UNSCHEDULED→WEEK→DAY→FIXED前後安排正確；相同安排、並發重複complete／cancel無重複事件；事件不可修改。|
|完成數及歷史查詢|PASS|將created_at設在2025年的任務於本月完成，完成數正確加1；科目／本週／本月篩選與分頁；取消獨立。|
|舊資料保留|PASS|真實v0.1備份還原到隔離庫後執行migration，逐表逐行比較每一個原有欄位相同，未偽造Event；舊終結任務精確時間未知有專門查詢與提示。`artifacts/v02/upgrade-preservation.json`。|
|獨立Review|PASS|保留自動／手動Review；Subject查詢最近10筆及每Topic最近紀錄；不以Event取代。|
|部署配置／secrets|PASS（本機檢查）|Production Compose只發布Caddy80/443；Web/PostgreSQL無host port；真正本機登入secret與VAPID私鑰未進前端bundle，私人生產模式拒絕HTTP／示例密碼。`deployment-security.json`。|
|Auth|PASS|未登入讀寫私人API401；登入後正常核心流程；登出後原token被拒絕；手機設定頁可登出。|
|通知連結登入恢復|PASS（瀏覽器連結流程）|未登入直接開啟Task URL→登入→回到對應Task Detail。`login-deeplink.json`。此項不是實體通知點擊實測。|
|Reminder concurrency|PASS（自動測試）|browser/browser及browser/Push競爭只有一個claim；重試同token；新的Push模式仍允許舊browser claim完成；修改id失效、完成取消停止舊提醒；404/410訂閱清理。|
|實際本機通知|PASS（Chrome開頁）|21:38:00.592到期，21:38:04.086瀏覽器確認delivered，attempts=1；實際ServiceWorker getNotifications有1個對應原生Notification。`notification-received.json`、`notification-ack.json`。不是單純permission／mock／provider log。|
|歷史載入邊界|PASS|2000筆舊Session、2000筆Interval及2000筆Review下，state不返回歷史明細，單次測量5139 bytes／29ms；History每頁有上限，Subject recent≤10。此為固定資料量單次測量，不是18個月實際使用或全面性能保證。|
|時間及部分完成回歸|PASS|A–J資料／API核心斷言保留；40+60/120餘20、加30超10；60/35停止、Pause、跨日、40/27及超時；英文40＋Routine80不重扣。|
|局部編輯正確性|PASS|修正未提交欄位被建立預設值覆蓋的舊問題。英文Task有Session後只改remaining，不改Topic／estimated／note／is_review／bucket。|
|前後端拆分|PASS|main.tsx約438行、server/index.ts約100行；功能邊界拆分、共用type修正；框架和產品視覺保留。|
|1440px / 390px完整流程|PASS|兩次真實CUA瀏覽器：無日期新增→本週→今天→開始→暫停→2/3子項→恢復→停止→刷新→繼續→完成→Subject/Writing查回。`e2e-1440.json`／`e2e-390.json`。|
|新History / Timeline UI|PASS|手機視窗科目／月份篩選、本月完成2、時間線含前後安排；登入後直達任務。`history-timeline.txt`、`timeline-mobile.png`。|
|Build / tests|PASS|`npm run build`、14/14自動測試；新Auth/Event/claim/資料量及PATCH回歸。`tests.txt`、`build.txt`。|
|Docker image / up|PASS|實際production映像建置，隔離Compose健康啟動；不是只檢查YAML。`docker-build.txt`。|
|Docker restart / persistence|PASS|獨立verify project的Web及Postgres重啟，全表原值相同；暫停Session／部分子項／待發Reminder／Auth session保持，Resume/Stop事件各一次。`docker-before.json.result.json`、`paused-restart.json`。|
|Backup / restore|PASS|真實pg_dump還原到獨立庫，比較所有表全部行，含task_events/auth_sessions/auth_attempts；沒有覆蓋正式資料庫。|
|資料隔離|PASS|本輪完整流程全部在study_test／study_browser_test／獨立Docker verify庫完成，未使用或修改正式資料庫。|

Unit/API tests中的35分鐘、跨日等以明確控制的測試間隔驗證；瀏覽器流程是真實短時間操作，不宣稱真人學習了35分鐘。Push provider失效測試使用受控transport stub；不冒充手機Push到達。

## Linux與手機待驗收

|必需條件|狀態|下一步|
|---|---|---|
|使用者Linux私人HTTPS部署|NOT_RUN|網域尚未決定。production Compose／Caddy及啟動說明已交付，需先確認主機既有80/443配置和DNS。|
|HTTPS真機背景通知|NOT_RUN|在支援手機加入主畫面／授權通知，設定Reminder，離開前景，觀察到達並點擊直達Task。至少一條完整實機證據。|
|私人部署實際未授權存取／TLS|NOT_RUN（本機API保護已PASS）|遠端部署後从未登入裝置檢查401、TLS和資料庫外部不可達。不能用本機結果替代。|
|多装置／OS通知限制|NOT_RUN|目前策略為每Reminder單一接收端，不是向所有裝置廣播；需以使用者選定手機核對。|

提醒採DB傳送權、固定接收端、SW收據與唯一tag，正常競爭／重試有防護；OS顯示與本機／伺服器落盤並非原子交易，極端崩潰窗口不能保證數學上的exactly-once。登入過期、裝置離線、權限拒絕會延遲，不能只看推送服務accepted便聲稱delivered。

因此本次交付是**v0.2本機工程版本＋Linux部署準備**，並非全部v0.2 Definition of Done。網域和實機条件具備後，完成上述驗收才可更新整體狀態。

## 延續的真人待測

真人普通新增約5秒、典型每日安排≤3分鐘、實體手機UI及數週效益仍NOT_RUN；保留v0.1測量方式，不以自動化速度代替。舊版證據見 [ACCEPTANCE_V0.1.md](ACCEPTANCE_V0.1.md)。
