# 聊天備份助手（手機版 PWA）

這是一套**保留原本 ChatGPT 使用方式**的輔助軟體，不是另外的 AI 聊天機器人。可用 iPhone Safari、Android Chrome、電腦瀏覽器執行。版本 1.0，介面為繁體中文。

## 可以做的事情

- 匯入 ChatGPT 官方下載的 ZIP（其中有 `conversations.json` 或編號聊天 JSON），或直接匯入解壓後的聊天 JSON。
- 在手機本機解析可取得的聊天文字與時間順序、搜尋全部已匯入的文字，並依「工作、投資、生活、感情、未分類」分類；可人工修改分類。
- 在本機保存 ZIP 裡實際包含的部分圖片與附件，也能手動匯入照片、錄音、PDF、Word、Excel、CAD 等原檔。
- 手動補充新聊天的文字紀錄，或將單一聊天匯出 TXT。
- 產生包含整理後聊天 JSON、分類文字檔、附件，以及**成功儲存在本機**的官方原始 ZIP 的備份包，使用手機分享選單交給 Google Drive 或下載再上傳。
- 支援**重新匯入本工具建立的備份包**，例如換手機後還原之前整理的分類與已包含的原始附件（仍受手機空間限制）。
- 網頁部署到 HTTPS 後可安裝到手機主畫面，首次成功載入後可離線運作。

## 不能做的事情（請先看）

- **無法自動讀取 ChatGPT App 裡的新聊天**。ChatGPT 目前沒有提供給第三方此用途的帳號完整歷史同步介面。
- **不會在每天 00:00 自動匯出所有聊天或背景上傳到 Google Drive**。
- 不保證官方匯出檔有所有錄音、圖片與附件的原始檔；官方 ZIP 缺失的檔案，軟體也無法還原。
- 轉換成可搜尋文字會失去部分非文字及編輯分支資訊。**官方匯出的原始 ZIP 才是原始資料的依據**。
- 由於手機記憶體和儲存空間限制，來源 ZIP 超過 **130 MB** 時不會存入本機；單個從 ZIP 擷取的附件超過 **32 MB** 或所有擷取附件累計超過 **110 MB** 會略過；打包附件+原始 ZIP 超過 **260 MB** 時會停止打包，避免手機卡死。大型檔案請直接備份到 Drive 或使用電腦。

## iPhone / Android 佈署使用

**手機 PWA 需要 HTTPS 網址；直接在 iPhone「檔案」App 點開 HTML，無法保證所有功能能運作。**

1. 先在電腦解壓縮這個 ZIP，得到 `index.html`、`app.js`、`styles.css`、`jszip.min.js`、`sw.js`、`manifest.webmanifest` 和 icon 檔。
2. 將整個資料夾部署到支援 HTTPS 的**靜態網站主機**（例如 Netlify Drop、Cloudflare Pages 或 GitHub Pages）。這些檔案沒有伺服器端程式；**不要將私人聊天 ZIP 上傳到網站主機**。
3. 用 iPhone Safari 或 Android Chrome 開啟網站網址。
4. iPhone：Safari 的「分享」→「加入主畫面」。Android：Chrome 的「安裝應用程式／新增到主畫面」。
5. 從 ChatGPT「設定 → 資料控制 → 匯出資料」申請正式匯出，收到通知後下載官方 ZIP；在新工具內匯入。
6. 到「備份」產生 ZIP，用手機「分享」選擇 Google Drive（可用目標取決於手機與瀏覽器），或下載後開啟 Google Drive App 上傳。

**Windows 本機測試**：資料夾中開啟終端機，執行 `python -m http.server 8080`，再用瀏覽器開 `http://localhost:8080`。這只是本機測試；手機跨裝置需 HTTPS 或額外的本機網路設定。

## 資料與隱私

- 預設在瀏覽器 `IndexedDB` **本機儲存**，程式沒有 API Key 欄位、登入要求、分析追蹤、遠端資料 API、或自動傳輸私人檔案的程式碼。
- 資料**未做加密**。請不要在共用／不受信任的手機使用，也不要把含有私人資訊的備份 ZIP 分享到公用位置。
- 瀏覽器資料可能被系統清除；換手機時不會自動轉移。請定期把備份包傳到 Google Drive，並確認上傳成功。
- Google Drive 的雲端資料夾應保持私人，並開啟 Google 帳戶的兩步驟驗證。
- `navigator.share()` 是否提供 Google Drive 作為目的地，取決於裝置、瀏覽器與 Google Drive App 的安裝情況；分享選單開啟**不代表已備份成功**。

## 專案檔案

- `index.html`：主要畫面與功能入口
- `styles.css`：手機／桌面版響應式設計
- `app.js`：純前端 ZIP 匯入、索引、分類、IndexedDB、備份包
- `jszip.min.js`：本機隨附的 JSZip 3.x（MIT）
- `sw.js`、`manifest.webmanifest`、`icon-*.png`：離線及手機安裝支援

參考：[OpenAI 官方資料匯出說明](https://help.openai.com/en/articles/7260999)、[Web Share API 相容性](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)。

版本：v1.0（2026-11-11）。本軟體為個人輔助工具，不代表 OpenAI 官方提供的產品。
