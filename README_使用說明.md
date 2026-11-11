# 聊天備份助手 v1.1 — Google Drive 一鍵備份

此版本在 v1.0 增加 Google 官方 OAuth + Drive API 一鍵上傳。

## 更新 GitHub Pages

你現有的儲存庫：`https://github.com/loyulun23-hash/Allen`

只要將此壓縮檔解壓後的所有檔案，上傳到 GitHub 專案 **根目錄**並 Commit，保留原本 `main` / `(root)` GitHub Pages 設定即可。

至少需要覆蓋：`index.html`、`app.js`、`styles.css`、`sw.js`。請勿上傳任何私人聊天、附件、ZIP 或 Google API 金鑰。

如果看到舊版畫面：在 Safari 重新整理或關閉 PWA 後重開；必要時更新 App 快取，但不要直接清除網站資料（會遺失尚未另存的本機聊天）。

## 首次 Google Cloud 設定（無法由此程式自動代辦）

1. 登入 https://console.cloud.google.com/ ，建立或選取自己的 Google Cloud 專案。
2. 在 API Library 啟用 **Google Drive API**。
3. 到 Google Auth Platform（Google OAuth 同意畫面）填入 App 名稱及聯絡信箱，Audience 選 **External**，如為 Testing 則將自己的 Google 帳號加入 **Test users**。
4. Data access 加入範圍 `https://www.googleapis.com/auth/drive.file`。
5. 在 Clients 建立 **OAuth Client ID**，類型為 **Web application**；「Authorized JavaScript origins」填入：
   `https://loyulun23-hash.github.io`
   （不要加入 `/Allen/`，也不需在這個彈窗流程填 redirect URI）。
6. 複製 OAuth **Client ID**（以 `.apps.googleusercontent.com` 結尾）到備份助手「備份」頁面。這是公開識別碼，可以放在網頁上；**絕不可放 Client Secret**。
7. 按下「一鍵備份到 Google Drive」，Google 第一次會詢問授權，選擇正確帳號並同意。
8. 成功後會出現雲端備份檔與資料夾連結；驗證檔名、大小與父資料夾。

### 會上傳到哪裡？

程式採用最小 `drive.file` 權限，預設只讀寫由此 App 建立的檔案，會在 Google Drive 的「我的雲端硬碟」根目錄建立 **ChatGPT_備份助手_一鍵上傳** 資料夾，日後使用相同資料夾。此資料夾可在 Drive 裡手動移到既有 `ChatGPT 聊天備份` 主資料夾中，日後 App 仍能透過原檔案權限使用。

### 這不是自動監看 ChatGPT

「一鍵」指你按一次後，將**已匯入這個工具的資料**打包上傳；不會自行取得 ChatGPT App 的新對話、隱藏附件或完整錄音，也不會在手機鎖定時定時備份。

### 隱私與限制

- 除了向 Google 官方授權及上傳當次 ZIP，聊天資料仍在你的裝置本機處理。
- Access Token 僅保存在瀏覽器記憶體，重新開啟後可能再次跳出 Google 授權。OAuth Client ID 會保存在當前裝置的 localStorage。
- GitHub Pages 是公開的程式網站；不能把私人 ZIP 檔放進程式儲存庫。
- iPhone Safari/PWA 的 Google 彈出式授權可能被瀏覽器限制。建議**先在 Safari 一般分頁**開啟網站測試；若授權失敗，改用 Safari 一般分頁、允許彈出視窗，或在 Windows Chrome 測試。
- 大型 ZIP 可能受到 iPhone 記憶體或網路限制；失敗時保留原始 ZIP 並手動上傳，不要清除本機資料。
- 新增上傳功能未經你的 Google 帳號實際授權測試，需依首次使用結果驗證。

參考官方說明：
- https://developers.google.com/identity/oauth2/web/guides/overview
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
