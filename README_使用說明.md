# ChatGPT 聊天備份助手 v1.3 — Google Drive 不壓縮逐檔上傳

這是 v1.2 的更新版。**Google Drive 一鍵備份不再上傳 ZIP**，而是把聊天、附件及已匯入的官方 ZIP 內容保存成個別檔案。

## 如何更新 GitHub Pages

1. 在 GitHub `loyulun23-hash/Allen` 的 `main` 分支根目錄，選擇 `Add file → Upload files`。
2. 從 `ChatGPT_Backup_Assistant_v1.3_Update_5Files.zip` **解壓縮**，將其中五個檔案（`app.js`、`index.html`、`styles.css`、`sw.js`、`README_使用說明.md`）上傳並取代同名舊檔。
3. 按 `Commit changes`，待 GitHub Pages 重新部署；開啟 `https://loyulun23-hash.github.io/Allen/`。
4. 進入「備份」分頁，確認顯示 `v1.3` 與「一鍵上傳原始檔到 Drive（不壓縮）」。iPhone 若看到舊畫面，請先重新開啟 App，必要時以 Safari 分頁載入新版；**勿直接清除網站資料**，以免遺失本機附件。

原有本機資料庫名稱 `chat_backup_assistant_v1`、Google OAuth Client ID 儲存鍵均維持不變。更新程式不應清除之前匯入的資料。

## 雲端備份結構

程式在原有的 `ChatGPT_備份助手_一鍵上傳` 資料夾下，每次建立新的快照。上傳期間資料夾名稱以 `未完成_` 開頭；全部檔案成功上傳、檔名與大小核對完才改名為 `完成_`。

```
ChatGPT_備份助手_一鍵上傳/
└── 完成_2026-11-12_10-00-00_5檔/
    ├── README_請先閱讀.txt
    ├── 備份清單.json
    ├── 聊天紀錄/
    │   ├── conversations_normalized.json  (可再匯入本工具)
    │   ├── 工作/
    │   ├── 投資/
    │   ├── 生活/
    │   ├── 感情/
    │   └── 未分類/
    ├── 附件/
    │   ├── 工作/
    │   ├── 投資/
    │   ├── 生活/
    │   ├── 感情/
    │   └── 未分類/
    └── 官方匯出解壓/
        └── 001_官方檔名/        (僅本機已保存的原始 ZIP 才會出現)
```

空分類不會建立。每則聊天有獨立 `.txt`；`conversations_normalized.json` 保存整理過的索引資料、分類及訊息，可下載後在助手中以 `.json` 格式重新匯入。附件保留匯入時的原始位元組與檔案格式（例如 `.png`、`.pdf`、`.m4a`）。

**官方 ZIP 原始位元組不會上傳到雲端。** 如果你的助手本機保存了官方 ZIP，程式會解壓並把其中的檔案依路徑逐一上傳。如果 ZIP 內仍含另一層 ZIP，或某檔解壓後超出手機安全上限 48 MiB，程式會顯示未完成，不會默默漏檔或宣稱成功。建議在電腦另行處理超大檔。

## 雲端備份與 ZIP 下載的區別

- **一鍵上傳原始檔到 Drive（不壓縮）**：個別檔案直接上傳到雲端，會建立新快照資料夾。
- **建立備份 ZIP / 下載 ZIP**：只供你下載到本機作另一份封存；**不會**由一鍵上傳功能送到 Drive。
- 先前已存在 Google Drive 的 ZIP 檔不會被自動刪除或轉換。

## 上傳時注意

- 必須已在 Google Cloud 啟用 Drive API、建立 Web OAuth Client ID，且帳號可授權 `drive.file`。
- iPhone 請保持備份助手在前景，不要切換或關閉畫面。備份量大時，逐檔上傳可能花較久。
- 大於 5 MiB 的檔案使用 Google Drive resumable upload 分段傳送；如果網路中斷或 Google 授權過期，本次快照仍標示 `未完成_`。重新點按會建立**另一份**快照，舊的不完整資料夾不會自動清除。
- 上傳成功不等於 ChatGPT 帳號所有內容已保存：助手只能備份**實際匯入的聊天與附件**，也無法自動讀取 ChatGPT App 的新對話或補回官方匯出未包含的錄音。
- 如果使用者手動加入 `.zip` 作為附件，程式會要求先解壓再加入，以符合雲端不保存壓縮檔的設定。
- 請勿把 ChatGPT 歷史資料、OAuth Client Secret、Access Token 等個人資料上傳至公開的 GitHub 儲存庫；GitHub Pages 應只放程式檔案。

## 資料保護

本工具在裝置內 IndexedDB 儲存匯入資料。Google OAuth Access Token 只在記憶體暫存，不保存密碼。上傳由使用者點擊觸發，使用 `drive.file` 權限，不會自動刪除任何既有 Google Drive 檔案。

完整性核對是檔名、尺寸及所在資料夾；**不等於進行了逐位元雜湊比對**，不保證所有可解碼的媒體完整無損。原始資料仍應另存保留。
