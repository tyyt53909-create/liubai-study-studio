# 留白 · DSE Study Studio

繁體中文、香港時區的私人學習管理工具。任務收集 → 五種安排層級 → 學習計時 → 部分停止／繼續 → 任務歷史與複習記憶。

**v0.3 Daily Study Workflow 本機工程交付。真人快速記錄／長期使用、Linux HTTPS及實體手機背景通知仍待驗收。** 詳見 [驗收報告](docs/ACCEPTANCE.md)。

## 本次本機專案

這是可自託管的單一使用者專案。測試資料只使用隔離資料庫，不會覆蓋使用者自己的資料。

入口：<http://localhost:4317>。已建立私人登入設定：初始密碼保存在本機 `.login-secret`，可用自己的編輯器開啟。此檔、`.env`、備份與原始驗收資料均不提交 Git。保存到自己的密碼管理器後，可自行移除 `.login-secret`。

本次 Mac 使用既有 Colima context：

```sh
DOCKER_CONTEXT=colima-mentora-v2 docker-compose up -d --build --wait
```

若雲端檔案提供者造成讀取延遲，可設定 `STUDY_RUNTIME` 後執行 `./scripts/sync-runtime.sh`，再到該目錄執行指令。腳本排除 `.git`、`.env`、依賴及證據；不要讓 runtime 目錄被公開同步。

## 新環境啟動

需要 Node24+、Docker Engine、Docker Compose。使用含 `!override` 的獨立驗收配置需 Compose 2.24.4+。

```sh
npm ci
npm run setup
docker compose up -d --build --wait
```

`setup` 生成隨機登入密碼、scrypt hash、資料庫密碼及 VAPID 金鑰，拒絕覆蓋既有 `.env`；初始明文只在 `.login-secret` 與終端一次輸出。可用 `--domain`／`--email` 寫入生產用 `PUBLIC_ORIGIN`。首次啟動自動建立 schema、科目與每週 Routine。已有 PostgreSQL volume 的升級須沿用原資料庫密碼；改 `.env` 不會替既有資料庫改密碼。**Linux 請用下方一鍵部署，不要沿用本機 `study_local`。**

本機 Compose 的 Web4317與資料庫55439只綁定127.0.0.1。這不是遠端部署配置。

## Linux 私人 HTTPS 一鍵部署

需要：Linux 主機、Docker Engine、Docker Compose、Node 20+（僅首次產生金鑰）、已指向該主機的網域（80／443 可從公網連入以申請 TLS）。

```sh
git clone https://github.com/tyyt53909-create/liubai-study-studio.git
cd liubai-study-studio
./scripts/deploy.sh --domain study.example.com --email you@example.com
```

腳本會：

1. 檢查 Docker／Compose／Node
2. **若尚無 `.env`**：執行 setup，寫入隨機資料庫密碼、登入 hash、VAPID，並把 **首次登入密碼** 寫入 `.login-secret`（權限 600），同時在終端顯示一次
3. **若已有 `.env`**：沿用既有密鑰，**不會**重產密碼
4. `docker compose -f compose.production.yaml up -d --build --wait`（Caddy 對外 80／443）
5. 印出 `https://你的網域` 與密碼位置

之後可再執行同一命令升級映像；密鑰保持不變。只產生密鑰、不起容器：

```sh
npm ci
npm run setup -- --domain study.example.com --email you@example.com
# 再顯示一次初始密碼（若 .login-secret 仍在）：
npm run setup -- --print-password
docker compose -f compose.production.yaml up -d --build --wait
```

### 首次密碼怎麼拿

| 時機 | 方式 |
| --- | --- |
| 剛跑完 `deploy.sh` / `setup` | 終端會印出一次；檔案在主機 `.login-secret` |
| 之後還在主機上 | `npm run setup -- --print-password` 或 `cat .login-secret` |
| 已存進密碼管理器 | 可刪除 `.login-secret`（不影響已寫入的 hash） |
| 登入之後 | 在 **日常設定 → 更改密碼**；其他裝置 session 會失效，本機保持登入 |

**不要**把 `.env`、`.login-secret` 或明文密碼提交 Git、貼進 GitHub Issue／Actions log。

### 安全邊界

- [compose.production.yaml](compose.production.yaml) + [deploy/Caddyfile](deploy/Caddyfile)：只有 Caddy 發布 80／443；PostgreSQL 與 Web **無** host port。
- `PRIVATE_DEPLOYMENT=true` 時拒絕非 HTTPS、過短／示例資料庫密碼、缺失登入 hash。
- 除 `/api/health` 與登入外，API 需有效 session；HTTPS 使用 `__Host-`、Secure、HttpOnly、SameSite=Strict cookie。
- 主機若已占用 80／443，先整合既有反向代理，不要直接搶埠。
- 這是**單用戶自託管**工具，不是多租戶 SaaS。

### 主機側忘記密碼（無法登入時）

1. 在伺服器刪除（或移走）`.env` 與 `.login-secret` **僅當**你接受重產全部密鑰，或
2. 較穩妥：保留 `.env`，用本機 Node 生成新的 `salt:hash`，只改 `STUDY_PASSWORD_HASH`，並在資料庫執行 `UPDATE settings SET password_hash=NULL WHERE id=1;` 與 `DELETE FROM auth_sessions;`，再 `docker compose -f compose.production.yaml up -d --build`。
3. 應用內改密後，資料庫 `settings.password_hash` 優先於環境變數。

## v0.3 日常操作

1. **快速記下**：Today 或任務池按「新增任務」，只輸入標題即可保存。科目與預估時間保持未分類／未估時，不代填；保存後清除舊搜尋條件。展開選填區可一次補齊，或稍後在任務詳情的「編輯內容」補上。
2. **快速改期**：任務卡的「改期」可選今天、明天、本週、下週、日期或取消安排。FIXED 移到某一天保留原時間與提醒選擇；移到週或未安排則移除指定時間及連結提醒。進行中的任務也能改期。
3. **一次設定時間與提醒**：選擇「指定時間」時，「到這個時間提醒我」預設開啟，可關閉。改時間即同步提醒，移除 FIXED 即移除連結提醒。舊 v0.2 FIXED 不會因升級自行開啟提醒。設定過去的指定時間且開啟提醒時，會盡快提醒。
4. **完成後下一步**：完成即保存，不必建立下一步。可選「新增後續任務」，輸入新標題，帶入科目／Topic；或「再做一次」，另建同標題、科目／Topic、預估與複習選擇的任務。兩者皆回到未安排，不帶舊 Session、Review、Reminder、子項、完成時間或原事件。
5. **Today 直接開始**：目前學習及今日任務優先顯示，任務卡直接開始／繼續和改期，active bar 保持全局可見。容量與完成推算可按需展開；尚未估時的工作不計入剩餘容量推算，畫面會提示其不完整。
6. **提醒後快速行動**：通知連結進入任務後，直接開始／繼續、延後30分鐘或移到明天。「延後30分鐘」設定從現在起的手動提醒，解除到點連結但保留原 FIXED 時間；沒有提醒時按此按鈕也會明確建立一個提醒。一般改期保留手動提醒，只有 FIXED 的連結提醒隨時間移動。
7. **找回歷史任務**：任務池切到已完成／已取消後搜尋，後端先搜尋完整可查資料，再分頁，支援不分大小寫的標題文字搜尋。

未分類任務仍可開始、暫停、停止及完成，實際投入時間照常保存；未分類的 Session 不自動建立無科目的 Review。補上科目後的新 Stop／Complete 可建立 Review，既有 Review 不回填或改寫。首次補上預估會扣除已投入時間；之後原先預估與剩餘估時仍分開修改。清除原先預估回到未估時，實際時間保留。

## 任務、計時與歷史

- Task只需標題；科目、估時、日期、Topic、子項、提醒及備註可稍後補上。未完成任務始終可在任務池找到。
- UNSCHEDULED／MONTH／WEEK／DAY／FIXED 是不同語義；本月、本週不會自動虛構時刻。
- 英文固定120分鐘、自選120分鐘是平日預設，可於日常設定修改。英文任務佔固定桶，Routine只補尚未分配的預留。
- 預估、累積實際、剩餘估時分開；Pause不計時，Stop保留IN_PROGRESS，Continue延續。關閉頁面不等於暫停。
- Task Event保存建立、改期、開始／暫停／恢復／停止、完成和取消；事件不可修改。重複完成／取消或不變安排不重複寫事件。
- 「紀錄」可切換任務紀錄／複習紀錄，按全部、本週、本月及科目查詢；每頁最多30筆（API最多50筆）。任務詳情有按需載入的時間線。
- 本月完成數按真正 `completed_at` 計算。舊已完成／取消任務未偽造時間，顯示「v0.2 前，精確時間未知」。
- Review獨立存在，仍只代表記錄的活動；並非掌握度或成效。有效的複習Session在Stop／Complete生成獨立Review，亦可手動補記。

## 提醒語義與限制

先在日常設定授權瀏覽器通知，再設定手動提醒或啟用 FIXED 到點提醒；Quick Capture 和一般非 FIXED 安排不會自行通知。

- `pending`：等待時間／可用接收端。
- `sending`：已取得資料庫傳送權；`accepted_at`僅代表推送服務接受，**不是瀏覽器送達**。
- `delivered`：Service Worker顯示或已持有對應通知，並完成伺服器確認。
- `error`：失敗待重試；404/410訂閱會清理，其他暫時失敗30秒後由原接收端重試。

同一提醒只選一個接收端，持久化claim防止輪詢與Push競爭。已選接收端的重試不任意換裝置；多個訂閱時並非廣播到每個裝置。配置可用Push後開頁輪詢讓Push負責；沒有訂閱時由開頁通知接手。

Service Worker共用串行顯示流程、IndexedDB收據與唯一notification tag。重複請求／重啟後重試不應再次提示。完成／取消及提醒改期會使舊提醒失效，顯示前再次驗證。通知點擊攜帶Task連結；登入後仍返回原任務。

**可靠性邊界：**系統不把網路傳送當作已顯示；OS通知、IndexedDB寫入與伺服器ack無法形成同一原子交易。極端情況下在顯示與本機收據保存之間瀏覽器崩潰，且通知已被清除，不能承諾數學上的exactly-once。正常競爭、重試及持久化路徑有對應測試。未啟用Push時須保持網頁開啟；電腦休眠、裝置離線、權限封鎖或登入過期會延遲送達。

本機Chrome已實際收到新版通知並回報delivered。**Linux HTTPS＋實體手機「背景→收到→點擊→任務」尚未實測。** iPhone/iPad需支援Web Push的系統並加入主畫面；不同裝置／瀏覽器的限制須在真機驗收記錄。PWA manifest及192/512圖示已提供。

## 開發與驗證

```sh
npm run dev
npm run build
npm test
```

開發會讀取本機 `.env`。`npm test` 使用獨立 `study_test` 和4318埠，生成只用於測試的登入資料，自動啟停伺服器；會清理此測試庫，不得改指正式庫。測試包含A–J、TaskEvent、Auth、Reminder競爭及分頁／彙總邊界。大量舊Session、Interval、Review不再進入每15秒的刷新；目前active間隔與SQL彙總仍供即時計時。

主要模組：`src/components/{Today,Tasks,TaskDetail,Planning,Subjects,History,Reviews,Settings,Login}`、`src/lib`、`server/routes`、`server/services`、`server/auth.ts`、`server/migrations`。框架仍為React/Vite/Express/PostgreSQL，未加入ORM或微服務。

v0.3 瀏覽器回歸透過 CUA 執行 `scripts/browser-v03.mjs` 的 `workflow({tab,browser,width,output})`，只允許 localhost:4319 的隔離環境（本輪使用 `study_browser_v03`）。舊 `browser-acceptance.mjs` 保留為 v0.1 歷史腳本。專用Docker驗收配置用獨立project、volume及55440／4320埠：

```sh
docker compose -p dse-study-studio-v02-verify -f compose.yaml -f compose.verify.yaml up -d --no-build --wait
```

這是本機驗收，前提為已建好 `dse-study-studio-web:latest`。不代表HTTPS或實體手機驗收。

## 備份、升級與還原

更新前先備份；v0.3 小型 schema 變更放寬 Task 科目／估時為可空，新增提醒連結欄位及 trigger；保留舊Task、Session、Interval、Review與Reminder，不反推未知完成時間。

```sh
./scripts/backup.sh
# Linux production:
COMPOSE_FILE=compose.production.yaml ./scripts/backup.sh
```

dump包含Task Event、登入session hash等私人資料，勿放到Git或公開下載。`.env`的登入hash、VAPID私鑰和資料庫憑證需另外安全備份。更換／遺失VAPID金鑰後裝置需重新訂閱。
備份檔預設為 `0600`，但仍是未加密的敏感資料；上傳到其他主機或雲端前，請使用 age／GPG／KMS 加密，並設定備份輪替與刪除政策。

先還原到新的獨立庫核對（名字已存在時換新名字）：

```sh
docker compose exec -T postgres createdb -U study study_restore_verify
docker compose exec -T postgres pg_restore -U study -d study_restore_verify --exit-on-error < backups/你的備份.dump
```

Production使用 `-f compose.production.yaml`。確認內容後才將Web的DATABASE_URL切到該庫，再啟動Web；原庫保留以便切回。若不希望還原舊登入，切換前清空還原庫的 `auth_sessions`，要求重新登入。

`scripts/snapshot-database.mjs capture|compare <file>` 可用明確 `DATABASE_URL` 對所有持久表做逐行比對；輸出同樣只保存在本機。一般restart/down/up保留volume；`down -v`會刪除資料，不用於一般更新。

[實作語義](docs/IMPLEMENTATION.md) · [v0.3需求](docs/V0.3_REQUIREMENTS.md) · [驗收與待辦](docs/ACCEPTANCE.md)

## License

本項目採用 [MIT License](LICENSE) 開源授權。
