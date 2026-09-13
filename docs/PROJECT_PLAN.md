# DSE 個人學習系統｜項目計劃書

**版本：V1.0**  
**定位：MVP 基線文件 / 項目邊界文件**

---

## 1. 項目名稱

**DSE 個人學習管理系統**

---

## 2. 項目背景

本項目面向個人 DSE 學習使用場景，主要使用者為學生本人。

目前典型學習結構包括：

- 平日固定約 2 小時英文學習；
- 額外約 2 小時自由分配學習時間；
- 自由時間主要分配到中文、DT、生物及其他科目；
- 週末主要按照本週、本月累積的學習任務進行處理；
- 任務經常不是完全固定，可能因學校進度、臨時功課、考試、實際完成速度等因素發生調整；
- 學習安排主要由學生本人決定，系統不負責替學生生成完整學習計劃。

目前單純把任務記在腦中存在以下問題：

- 容易忘記尚未完成的學習內容；
- 難以準確記得某一科或某一 Topic 上一次何時複習；
- 任務部分完成後，剩餘內容容易失去持續追蹤；
- 每日有限時間與任務工作量之間需要反覆人工計算；
- 任務提前完成或超時後，當天剩餘時間需要重新判斷；
- 本週、本月新增的任務容易堆積，但缺少統一的未安排狀態；
- 週末需要重新回憶本週有哪些事情仍未完成。

因此，本項目的核心不是建立普通 Todo List，而是建立一套能夠維持學習狀態、時間狀態及複習記憶的個人學習系統。

---

## 3. 項目目標

本項目最終要解決的問題是：

> **降低學習管理本身的認知成本與操作成本，使使用者把更多注意力留給真正的學習。**

系統需要承擔以下低價值管理工作：

1. 記住還有哪些學習任務尚未完成；
2. 記住哪些任務已經安排、哪些仍未安排；
3. 計算今日可用學習時間和已安排工作量；
4. 記錄任務的部分完成狀態；
5. 保存預計時間、實際時間與剩餘時間；
6. 保存某科、某 Topic 的歷史複習紀錄；
7. 在需要時提供「上一次複習時間」；
8. 處理中途停止、恢復、延期和臨時調整；
9. 對有明確時間要求的任務提供提醒；
10. 將學習過程中產生的狀態持續保留，而不依賴使用者記憶。

---

# 4. 產品核心原則

## 4.1 使用者決策，系統提供資訊

系統不得主動替使用者決定：

- 今天應該讀哪一科；
- 哪一科更重要；
- 任務優先級；
- 本週應如何自動分配；
- 應該增加或減少哪一科時間；
- 應該因歷史數據而自動生成強制安排。

系統可以提供：

- 未完成任務；
- 未安排任務；
- 可用時間；
- 已安排時間；
- 預計完成時間；
- 實際完成時間；
- 剩餘工作量；
- 上一次複習時間；
- Topic 歷史；
- 任務超時或提前完成的客觀資訊。

最終學習決策由使用者本人完成。

---

## 4.2 系統不是普通 Todo List

系統不能只提供：

- 任務名稱；
- Done / Not Done；
- 日期。

必須至少能處理：

- 月 / 週 / 日 / 具體時間等不同層級的安排；
- 任務預計時長；
- 任務部分完成；
- 子項目；
- 中途停止及恢復；
- 實際學習時長；
- 複習紀錄；
- 科目 / Topic 歷史；
- 當日時間容量。

---

## 4.3 執行行為應盡量自然留下紀錄

系統應避免：

> 完成學習 → 再額外花大量時間填寫紀錄。

理想方向：

> 建立 / 安排 → Start → Study → Stop / Complete → 系統保存必要狀態。

手動補充應是可選，而不是高頻強制輸入。

---

## 4.4 管理成本必須低

系統本身不得成為新的學習負擔。

目標：

- 普通任務快速新增應能在數秒內完成；
- 每日主要安排操作應控制在約 1–3 分鐘；
- 日常維護系統的總時間原則上不應高於約 5 分鐘；
- 不得要求每個任務都填寫大量欄位；
- Topic、Subtask、Reminder、Note 等只有在需要時使用。

---

# 5. 強邊界

以下為項目強邊界。除非後續明確修改項目方向，MVP 不應突破。

## 5.1 不做 AI 自動學習規劃

MVP 不實現：

- AI 自動安排每日學習；
- AI 自動安排每週學習；
- AI 自動決定科目優先級；
- AI 自動判斷應該讀什麼；
- AI 自動修改使用者任務。

AI 可以用於開發本項目，但不是 MVP 產品核心。

---

## 5.2 不做完整筆記系統

允許：

- 短備註；
- Material URL；
- 簡單附件能力可於後期增加。

不建設：

- Notion 式頁面系統；
- Obsidian 式知識圖譜；
- 大型 Markdown 筆記平台；
- Wiki / Backlink / Knowledge Base。

---

## 5.3 不做企業項目管理功能

不做：

- 多人協作；
- Team；
- Role / Permission 複雜體系；
- Gantt；
- Scrum；
- Sprint；
- 多層 Project 管理；
- 無限 Nested Tasks。

任務最多只需要：

> Task → Subtask / Task Item

一層子任務。

---

## 5.4 不做 Gamification

MVP 不包含：

- XP；
- Level；
- 排行榜；
- 強制 Streak；
- 勳章；
- 社交競爭。

---

## 5.5 不做原生 App

產品以 Web 為唯一主要客戶端。

允許：

- Responsive Web；
- PWA-like 能力；
- Web Push；
- 加到手機主畫面。

不做：

- iOS App；
- Android App；
- Flutter；
- React Native。

---

## 5.6 不做過度複雜基礎設施

MVP 原則：

- 單體 Web 應用；
- PostgreSQL；
- Docker；
- 必要時獨立 Reminder Worker。

不應為未存在的規模問題提前增加：

- 微服務；
- Kubernetes；
- Kafka；
- RabbitMQ；
- Elasticsearch；
- 複雜 Event Sourcing；
- Redis Queue，除非後續出現明確必要性。

---

# 6. 核心需求

## 6.1 Subject

系統必須支持科目。

例如：

- English；
- Chinese；
- Biology；
- DT。

每個 Task / Review Record 可以與 Subject 關聯。

---

## 6.2 Topic

Subject 下可存在 Topic。

例如：

```text
Chinese
├── 文言文
├── 閱讀理解
└── 寫作
```

```text
Biology
├── Genetics
├── Respiration
└── Ecology
```

Topic 是長期內容分類，不等同於 Subtask。

Topic 對普通 Task 可以為 optional。

---

## 6.3 Task

Task 表示一次需要完成的學習工作。

至少需要支持：

- Title；
- Subject；
- Topic（optional）；
- Estimated Duration；
- Planning Level；
- Status；
- Note（optional）；
- Reminder（optional）。

Task 必須可以在沒有具體日期和時間的情況下存在。

---

## 6.4 Subtask / Task Item

Task 可以包含一層子項目。

例：

```text
中文複習
├── 文言文
├── 閱讀理解
└── 寫作
```

子項目可以獨立完成。

主任務不能只存在「全部完成 / 全部未完成」兩種表現。

必須能反映部分完成。

Subtask 為可選能力，不應強制所有 Task 拆分。

---

## 6.5 Planning Level

Task 的安排必須區分不同時間語義。

至少包括：

- Unscheduled；
- Month；
- Week；
- Day；
- Fixed Time。

不能把「本週做」錯誤表示成某一天某一個虛構時間。

系統必須能明確顯示：

- 完全未安排；
- 本月但未落到週；
- 本週但未落到某一天；
- 已安排某一天；
- 已安排具體時間。

---

## 6.6 Estimated / Actual / Remaining Time

時間模型必須區分：

### Estimated Duration

安排任務時預計需要的時間。

### Actual Duration

真正執行後消耗的學習時間。

### Remaining Estimate

任務部分完成後預計仍需要的時間。

三者不能合併為同一概念。

Remaining Estimate 必須允許後續調整。

---

## 6.7 Task Status

核心狀態至少包括：

- TODO；
- IN_PROGRESS；
- COMPLETED；
- CANCELLED。

中途停止但仍需繼續的 Task 應保留為 IN_PROGRESS。

---

## 6.8 Daily Study Template / Routine

系統需要支持日常學習容量模板。

典型平日：

```text
English Fixed Allocation: 120 min
Flexible Study Capacity: 120 min
```

週末可以採取不同模式，例如 Task-based。

固定英文 2 小時不應要求使用者每天手動重新建立相同安排。

Daily Template 用於描述容量和固定學習結構，不等同於普通 Task。

---

## 6.9 Today Planning

系統需要讓使用者從未完成任務中選擇今天要執行的任務。

Today View 至少需要能表示：

- 今天可用學習容量；
- 固定學習時間；
- 自由安排容量；
- 已安排任務；
- 各任務預計時間；
- 已使用容量；
- 剩餘容量；
- 超出容量；
- 理論完成時間。

系統不得因超出容量自動刪除任務。

---

## 6.10 時間可視化

Today View 需要提供明顯的時間可視化。

初始產品方向為：

- 圓形 Time Ring / Clock Ring；
- 不同時間區段表示不同任務；
- 空白區域表示未使用時間；
- 下方配合任務卡片。

但：

> Time Ring 是 View，不是底層數據模型。

架構不能依賴圓形 UI。

後續可替換或補充 Timeline View，而不改變核心資料。

---

## 6.11 Study Session

Task 開始執行後需要有 Study Session。

至少支持：

- Start；
- Pause；
- Resume；
- Stop for now；
- Complete。

系統需要記錄實際有效學習時間。

同一 Task 可以經過多次 Session 才完成。

---

## 6.12 中途停止

如果一個 Task 預計 60 分鐘，實際完成 35 分鐘後停止：

系統不能視為完成，也不能丟失已完成部分。

需要保留：

- Actual Duration；
- Remaining Estimate；
- IN_PROGRESS 狀態。

之後允許 Continue。

---

## 6.13 提前完成 / 超時

如果任務實際完成時間與預估不同：

系統至少需要：

- 計算差額；
- 更新剩餘可用時間；
- 更新理論完成時間。

MVP 不要求自動把多出的時間重新分配給其他任務。

系統只提供資訊，由使用者決定如何使用剩餘時間。

---

## 6.14 Review Record

Review Record 必須作為獨立概念存在。

其用途是回答：

- 上一次複習某科是什麼時候；
- 上一次複習某 Topic 是什麼時候；
- 本週 / 本月曾經複習過哪些內容。

Review Record 不是單純 Task History。

至少需要關聯：

- Subject；
- Topic（optional）；
- Date / Time；
- Duration（如存在）；
- Source；
- Note（optional）。

Review Record 可以：

- 由學習執行自然產生；
- 或由使用者手動新增。

具體自動化程度可以在 MVP 實際使用後打磨，但底層必須保持 Review Record 與 Task 分離。

---

## 6.15 Subject View

每個 Subject 必須有獨立視圖。

至少可以查詢：

- 最近一次複習；
- 各 Topic 最近一次複習；
- 最近 Review Record；
- 未完成相關 Task。

目的：

> 幫助使用者在下一次安排時快速恢復對該科學習狀態的記憶。

系統不需要在 Subject View 自動給學習建議。

---

## 6.16 Task Pool

必須存在所有未完成學習工作的一個統一入口。

使用者應能看到：

- Inbox；
- Unscheduled；
- This Week；
- This Month；
- In Progress；
- Scheduled；
- Completed（歷史）。

重點不是建立傳統 Kanban，而是讓使用者清楚知道：

> 哪些事情還沒有完成，哪些事情還沒有真正安排。

---

## 6.17 Reminder

系統需要支持任務提醒。

核心原則：

- Reminder 必須由使用者明確設定；
- 有具體時間要求的任務可以推送；
- 不應因系統動態計算出的「預計開始時間」而大量自動推送；
- Web Push 為主要方向。

提醒屬於輔助功能，不應改變任務本身。

---

# 7. 核心使用流程

## 7.1 任務流程

```text
想到任務
   ↓
建立 Task
   ↓
Unscheduled / Month / Week
   ↓
安排到某一天
   ↓
加入 Today
   ↓
分配 Estimated Duration
   ↓
執行
   ↓
Complete / Stop for now
   ↓
保存狀態
```

---

## 7.2 每日學習流程

```text
打開 Today
   ↓
讀取 Daily Template
   ↓
看到固定時間 + Flexible Capacity
   ↓
從 Task Pool 選擇今天要做的任務
   ↓
系統計算已使用 / 剩餘容量
   ↓
顯示時間可視化
   ↓
Start
   ↓
Study Session
   ↓
Pause / Stop / Complete
   ↓
更新 Actual / Remaining
   ↓
重新計算今日剩餘時間
```

---

## 7.3 複習記憶流程

```text
完成學習
   ↓
形成 Review Record
   ↓
Subject / Topic History
   ↓
未來需要安排時查看
   ↓
使用者自己決定下一次學習內容
```

---

# 8. 核心頁面

MVP 核心頁面原則上包含：

1. **Today**
2. **Tasks**
3. **Week / Planning**
4. **Subjects**
5. **History / Review**
6. **Settings / Routine**

Exam 等能力可以後續增加。

---

# 9. 技術架構基線

項目運行方式：

> **Docker 部署 + Web 端使用**

推薦基線：

```text
Browser
   ↓
Next.js / TypeScript Web Application
   ↓
PostgreSQL
```

附加：

```text
Reminder Worker
   ↓
Web Push
```

Docker：

```text
docker compose

├── web
├── worker
├── postgres
└── reverse proxy / HTTPS
```

架構原則：

- 單體優先；
- 模組化程式結構；
- 不提前拆微服務；
- 前端視圖與核心 domain logic 分離；
- Planning / Session / Review 概念保持獨立；
- Time Ring 不進入核心資料模型。

---

# 10. 數據核心模型

核心 Entity：

```text
Subject
└── Topic

Task
└── Subtask / TaskItem

TaskPlan

StudySession

ReviewRecord

DailyTemplate

Reminder
```

核心模型含義必須保持穩定。

實際資料表、欄位、ORM 選型可以由實現模型根據需求自行設計。

---

# 11. MVP 成功標準

MVP 的成功不以功能數量衡量。

需要滿足以下結果：

### 任務管理

- 使用者可以在不安排日期的情況下記錄任務；
- 可以看到所有尚未完成及尚未安排的工作；
- 可以逐步從 Month / Week 移動到 Day；
- 部分完成不會被錯誤標記為全部完成。

### 時間管理

- 能表示固定英文 120 分鐘 + Flexible 120 分鐘的平日模型；
- 系統可以計算今日容量；
- 任務加入後可以計算剩餘時間；
- 超出容量時明確提示；
- 提前或超時後能重新計算理論完成時間。

### 執行

- 任務可以 Start；
- 可以 Pause / Resume；
- 可以 Stop for now；
- 可以 Complete；
- 中途停止後資料不丟失；
- 可以保存 Actual / Remaining。

### 複習記憶

- 可以查詢某 Subject 最近複習時間；
- 可以查詢某 Topic 最近複習時間；
- 可以看到歷史 Review；
- Review 不依賴使用者記憶。

### 使用成本

普通日常操作不能因系統過於繁瑣而比直接記在腦中成本更高。

---

# 12. MVP 後再評估的功能

以下不屬於核心基線，可在真實使用後決定：

- Exam Mode；
- Past Paper Score；
- 高級 Analytics；
- 更複雜 Weekly Review；
- Follow-up Task；
- Do Again；
- Material Attachment；
- Search 強化；
- 多種 Visualization；
- Time Ring 拖拽；
- 高級 Reminder；
- Offline；
- AI Analysis。

---

# 13. 項目最終判斷標準

本項目存在的價值不在於：

> 把「English / Chinese / DT」從腦中搬到卡片。

而在於系統能否真正接管：

- 學習負債；
- 未安排狀態；
- 今日時間容量；
- 任務部分完成；
- 剩餘工作量；
- 實際學習狀態；
- 複習歷史。

最終要求：

> **使用者只需要做學習決策，而不需要持續用腦記住和維護所有學習狀態。**
