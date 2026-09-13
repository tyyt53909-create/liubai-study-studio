# DSE 個人學習系統｜項目任務書

**版本：V1.0**  
**用途：交付開發模型 / Codex 的高層任務契約**

---

# 1. 任務

設計並實現一套可長期使用的個人 DSE 學習管理 Web 系統。

系統的核心目標是：

> **降低學生管理學習任務、時間、未完成內容與複習記憶所需要的認知成本，使更多注意力留給實際學習。**

系統必須能將：

```text
我要做什麼
↓
什麼時候做
↓
今天是否做得下
↓
現在做到哪裡
↓
還剩多少
↓
之前做過什麼
```

形成一套連續、低摩擦的工作流。

---

# 2. 使用背景

典型平日學習模式：

```text
English
約 120 分鐘固定學習

Flexible Study
約 120 分鐘自由分配
```

Flexible 時間主要分配至：

- Chinese；
- Biology；
- DT；
- 其他需要處理的學科。

週末主要按照：

- 本週未完成 Task；
- 本月 Task；
- 臨時增加 Task；

進行處理。

任務時間與內容可能隨實際情況調整。

使用者本人負責決定：

> 今天讀什麼、怎麼分配、什麼最重要。

系統負責提供狀態與客觀資訊。

---

# 3. 必須解決的問題

最終產品必須有效解決以下問題。

## P1. 任務容易被遺忘

使用者需要能快速保存現在不一定立即安排的學習任務。

---

## P2. 任務沒有明確的安排層級

系統需要區分：

- 尚未安排；
- 本月；
- 本週；
- 某一天；
- 具體時間。

---

## P3. 無法快速判斷今天是否排得下

系統必須根據 Daily Study Capacity 和 Task Estimated Duration 計算：

- 已使用時間；
- 剩餘時間；
- 超出的時間；
- 理論完成時間。

---

## P4. 部分完成容易失去狀態

任務可能只完成一部分。

系統需要保存：

- 已完成子項；
- 未完成子項；
- Actual Duration；
- Remaining Estimate；
- IN_PROGRESS 狀態。

---

## P5. 中途停止後需要重新回憶

任務中途 Stop 後，下一次應能直接 Continue，而不是重新建立。

---

## P6. 任務預估和實際時間不同

系統需要區分：

- Estimated Duration；
- Actual Duration；
- Remaining Estimate。

並在提前 / 超時後更新今日剩餘時間和理論完成時間。

---

## P7. 無法記得某科上一次複習時間

系統必須維持獨立 Review Record。

使用者應能查：

- Subject 上次複習；
- Topic 上次複習；
- 最近 Review；
- 本週 / 本月完成過哪些複習。

---

## P8. 固定學習結構需要每天重複輸入

系統必須支持 Daily Template / Routine。

例如：

```text
Weekday
English: 120m
Flexible: 120m
```

不要求使用者每天重新建立相同內容。

---

## P9. 新增 Task 持續累積但沒有統一入口

系統需要提供清晰 Task Pool，讓使用者知道：

- 哪些未完成；
- 哪些完全未安排；
- 哪些屬於本週；
- 哪些屬於本月；
- 哪些正在進行。

---

# 4. 必須支持的核心能力

## C1. Subject

支持不同學科。

---

## C2. Topic

Subject 可包含 Topic。

Topic 是長期分類，不是一次性 Task。

---

## C3. Task

Task 至少支持：

- Title；
- Subject；
- Topic optional；
- Estimated Duration；
- Planning Level；
- Status；
- optional Note；
- optional Reminder。

---

## C4. Subtask

Task 可以包含一層 Subtask。

Subtask 必須可以獨立完成。

不得要求所有 Task 都必須使用 Subtask。

---

## C5. Planning Level

至少支持：

```text
Unscheduled
Month
Week
Day
Fixed Time
```

---

## C6. Task Status

至少支持：

```text
TODO
IN_PROGRESS
COMPLETED
CANCELLED
```

---

## C7. Daily Routine

能表達不同日期 / 星期的固定和 Flexible Study Capacity。

---

## C8. Today Planning

使用者可把 Task 加入今日。

系統計算：

- total capacity；
- used capacity；
- remaining capacity；
- over capacity；
- estimated finish time。

---

## C9. 時間可視化

Today 必須存在清晰的時間可視化。

首選產品方向：

> Time Ring / Clock Ring + Task Cards。

但底層必須保持與特定視覺形式解耦。

---

## C10. Study Session

至少支持：

```text
Start
Pause
Resume
Stop for now
Complete
```

---

## C11. 中途停止

Stop for now 後：

- 不得標記為 Complete；
- 必須保存 Actual Duration；
- 必須保留 Remaining Estimate；
- 必須允許 Continue。

---

## C12. Review Record

必須存在獨立的 Review Record 概念。

Review Record 不得僅等同於 Completed Task。

---

## C13. Subject View

必須能查看：

- Last Review；
- Topic Last Review；
- Recent Review；
- Open Tasks。

---

## C14. Reminder

支持使用者主動設置 Web Reminder。

不得默認用系統動態估算出的 Task start time 大量推送。

---

# 5. 強制產品邊界

最終方案不得把產品改造成下列產品：

## 禁止變成 AI Planner

不得以 AI 自動學習規劃作為主流程。

---

## 禁止變成普通 Todo App

只實現：

```text
Task
Date
Done
```

不視為完成需求。

---

## 禁止變成完整 Calendar App

Calendar 可以作為輔助視圖，但不是產品核心。

---

## 禁止變成筆記軟體

不得用大量筆記、Wiki、Markdown Page 取代 Task / Review 核心。

---

## 禁止變成企業 Project Management

不得引入不必要的：

- Team；
- Workspace；
- Sprint；
- Project hierarchy；
- 無限 Nested Tasks；
- Gantt 等。

---

## 禁止不必要的複雜基礎設施

運行環境為 Docker + Web。

在不存在明確需求的情況下，不需要：

- 微服務；
- Kubernetes；
- Kafka；
- RabbitMQ；
- Elasticsearch；
- 複雜 Event Sourcing。

---

## 禁止高管理成本

不得要求使用者在日常使用中大量維護系統。

普通 Task 應可快速建立。

高級欄位應 optional。

---

# 6. 技術環境限制

產品必須：

- Web 使用；
- Docker 部署；
- 可在桌面和手機瀏覽器使用；
- 數據持久保存；
- 適合個人長期使用；
- 支持後續擴展但不為未來假設過度設計。

推薦但不強制具體實現方式：

```text
Web Application
Database
Reminder Worker
HTTPS / Web Push
```

具體框架、ORM、模組結構等可以根據上述需求自行選擇，只要不突破項目邊界。

---

# 7. 功能驗收標準

## A. Task Capture

**驗收：**

- 可以建立一個沒有日期的 Task；
- 建立 Task 不需要強制填 Topic / Reminder / Note；
- 可以之後再安排。

---

## B. Month / Week / Day Planning

**驗收：**

至少可以準確區分：

```text
完全未安排
本月
本週
某一天
具體時間
```

不能將不同語義錯誤合併。

---

## C. Daily Capacity

給定：

```text
Flexible Capacity = 120m

Task A = 40m
Task B = 60m
```

系統應明確得到：

```text
Used = 100m
Remaining = 20m
```

若加入：

```text
Task C = 30m
```

需要得到：

```text
Used = 130m
Over Capacity = 10m
```

---

## D. Partial Completion

給定：

```text
中文複習

Subtask A
Subtask B
Subtask C
```

只完成 A、B 時：

- A、B 為 Completed；
- C 為未完成；
- 主 Task 不得被錯誤視為全部完成；
- 系統能表達部分完成。

---

## E. Stop / Continue

給定：

```text
Estimated = 60m
```

執行 35m 後 Stop for now：

系統至少需要保存：

```text
Actual >= 35m
Status = IN_PROGRESS
Remaining Estimate 可用
```

下一次可以 Continue。

---

## F. Estimated vs Actual

如果：

```text
Estimated = 40m
Actual = 27m
```

系統需要反映：

```text
Saved = 13m
```

並更新 Today 剩餘時間 / 理論完成時間。

如果 Actual > Estimated，同理反映超時。

---

## G. Review Memory

假設存在：

```text
Sep 1
Chinese / Writing

Sep 5
Chinese / Classical Chinese
```

系統必須能正確回答：

- Chinese 最近一次複習日期；
- Writing 最近一次複習日期；
- Classical Chinese 最近一次複習日期。

---

## H. Daily Template

配置：

```text
Weekday
English = 120m fixed
Flexible = 120m
```

下一個平日打開 Today 時：

- 不需要重新建立 English 120m；
- 系統能正確提供 Flexible Capacity。

---

## I. Unscheduled Work

若存在尚未安排的 Task：

系統必須有明確入口讓使用者看見。

不得因沒有日期而使 Task 從主工作流消失。

---

## J. Reminder

若使用者明確設定：

```text
Task Reminder = 20:00
```

系統應能在相應條件下發出 Web Notification / Push。

沒有設定 Reminder 的普通 Flexible Task 不應被系統任意推送。

---

# 8. 非功能驗收標準

## 8.1 使用成本

目標：

- 普通新增 Task 操作可在約 5 秒級完成；
- 每日安排典型流程不需要大量重複資料輸入；
- 固定 Routine 不要求每日重新設定。

---

## 8.2 數據可靠性

以下狀態不得因頁面刷新或服務正常重啟而丟失：

- Task；
- Task Status；
- Subtask completion；
- Study Session；
- Review Record；
- Planning；
- Routine。

---

## 8.3 響應式

核心流程至少應可在：

- Desktop browser；
- Mobile browser；

正常使用。

---

## 8.4 可維護性

系統核心概念需要保持清晰：

```text
Subject
Topic
Task
Subtask
Plan
Session
Review
Routine
Reminder
```

不能因 UI 方便而把多個概念全部混入單一 Task 結構。

---

# 9. MVP 完成定義

MVP 完成不是「所有想得到的功能都做完」。

當使用者可以完成以下完整循環時，視為 MVP 主體成立：

```text
建立待做 Task
↓
先不安排或安排到本週
↓
之後選入今天
↓
看到今日時間容量
↓
開始 Task
↓
Pause / Stop / Complete
↓
保存實際完成狀態
↓
未完成內容仍存在
↓
形成可查詢的 Review Record
↓
之後從 Subject View 找回學習歷史
```

同時，固定：

```text
English 120m
+
Flexible 120m
```

的平日 Routine 可以直接被系統使用，而不要求每日重建。

---

# 10. 可量化的項目成功指標

MVP 實際使用後，至少應朝以下指標驗證：

### Task Capture

普通 Task 從想到到完成記錄：

> **目標 ≤ 5 秒級**

---

### Daily Planning

典型平日選擇 Flexible 120m 內的學習任務：

> **目標 ≤ 3 分鐘**

---

### State Recovery

重新打開系統後，使用者應能在很短時間內回答：

- 今天還剩什麼；
- 本週還剩什麼；
- 哪些 Task 未安排；
- 某一 Task 做到哪；
- 某一 Subject / Topic 上次何時複習。

---

### Duplicate Management Cost

完成 Task 後：

> 不應要求使用者再次手動輸入一整套相同資訊才能保存歷史。

---

### Long-term Utility

系統使用數週後，歷史資料應能直接支持：

> 「我上次複習這個 Topic 是什麼時候？」

而不是仍然依靠使用者記憶。

---

# 11. 模型自由度

在遵守：

- 項目目標；
- 核心需求；
- 強邊界；
- 驗收標準；

的前提下，實現模型可以自由決定：

- UI 細節；
- 交互形式；
- 程式模組；
- Database schema；
- API 設計；
- component 結構；
- library；
- internal algorithm；
- Time Ring 具體視覺；
- Task Card 細節；
- 合理的 UX 改進。

允許模型發散與改進。

但任何發散都必須服務於：

> **降低學習管理成本，而不是增加功能數量本身。**
