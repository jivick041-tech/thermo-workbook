/**
 * 材料熱力學練習簿：雲端紀錄＋遊戲進度
 * 第一個工作表：學生作答紀錄（每個事件一列）
 * 「修煉進度」工作表：每位學生一列（境界、能量、連續天數、名器……），供跨裝置同步與排行榜使用
 *
 * 更新方式：擴充功能 → Apps Script，整段貼上取代舊程式碼並存檔，
 * 再「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本：新版本 → 部署」，網址不會改變。
 */
const HEADERS = ['時間','學號','姓名','單元','事件','項目','類型','結果','卡關步驟','提示次數','花費分鐘','自評理解','回饋','裝置工作階段'];
const KEYS    = ['sid','name','unit','event','itemId','type','result','stuckStep','hints','minutes','rating','feedback','session'];
const GAME_SHEET = '修煉進度';
const GAME_HEADERS = ['學號','姓名','暱稱','等級','境界','累積能量','連續天數','最長連續','練功天數','名器','更新時間','資料'];

function clean_(v) {
  v = String(v == null ? '' : v).slice(0, 2000);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function validSid_(sid) { return /^[A-Za-z0-9]{4,12}$/.test(String(sid || '')); }

function gameSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(GAME_SHEET);
  if (!sh) { sh = ss.insertSheet(GAME_SHEET); sh.appendRow(GAME_HEADERS); sh.setFrozenRows(1); }
  return sh;
}
function findGameRow_(sh, sid) {
  const n = sh.getLastRow();
  if (n < 2) return 0;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(sid)) return i + 2;
  return 0;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (!validSid_(d.sid)) return ContentService.createTextOutput('bad sid');

    if (d.kind === 'game') {                     // 遊戲進度：每位學生一列，能量只增不減
      const sh = gameSheet_();
      const r = findGameRow_(sh, d.sid);
      const xp = Number(d.xp) || 0;
      if (r) {
        const old = Number(sh.getRange(r, 6).getValue()) || 0;
        if (xp < old) return ContentService.createTextOutput('older');
      }
      const row = [clean_(d.sid), clean_(d.sname), clean_(d.nick), Number(d.lv) || 1, clean_(d.title), xp,
                   Number(d.streak) || 0, Number(d.best) || 0, Number(d.days) || 0, clean_(d.items), new Date(),
                   String(d.data || '').slice(0, 45000)];
      if (r) sh.getRange(r, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
      return ContentService.createTextOutput('ok');
    }

    // 作答紀錄
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
    sh.appendRow([new Date()].concat(KEYS.map(k => clean_(d[k]))));
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

/* 讀取：?action=gload&u=學號&cb=函式名 → 該生的遊戲資料；?action=board&u=學號&cb=… → 排行榜 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = String(p.cb || '');
  if (!/^[A-Za-z_$][\w$]{0,40}$/.test(cb)) return ContentService.createTextOutput('材料熱力學練習簿紀錄服務運作中');
  let out = '';
  if (p.action === 'gload' && validSid_(p.u)) {
    const sh = gameSheet_(), r = findGameRow_(sh, p.u);
    out = r ? String(sh.getRange(r, 12).getValue() || '') : '';
  } else if (p.action === 'board') {
    const sh = gameSheet_(), n = sh.getLastRow();
    const rows = n < 2 ? [] : sh.getRange(2, 1, n - 1, 9).getValues();
    rows.sort((a, b) => (Number(b[5]) || 0) - (Number(a[5]) || 0));
    const me = rows.findIndex(x => String(x[0]) === String(p.u)) + 1;
    const top = rows.slice(0, 20).map(x => ({ nick: String(x[2] || '無名學徒'), title: String(x[4] || ''), xp: Number(x[5]) || 0, streak: Number(x[6]) || 0 }));
    out = JSON.stringify({ top: top, me: me || 0, n: rows.length });
  }
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(out) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
