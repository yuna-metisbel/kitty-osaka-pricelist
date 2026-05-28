const fs = require('node:fs/promises');

const API_BASE = 'https://webapi2.mrvenrey.jp';
const HEAVEN_PROFILE_BASE = 'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka';
const HEAVEN_BAITAI_CODE = 'bth01';

function normalizeName(value) {
  return (value || '')
    .replace(/\s+/g, '')
    .replace(/／/g, '/')
    .replace(/\/(単体AV|即尺|元タレント).*$/u, '')
    .replace(/・(店長オススメ|極嬢|超逸材|超新星|未経験|極上|JK|元タレント|動画無料|激推し嬢|推姫|アイドル|憧れの美ギャル|憧れの美ぎゃる|全身性感帯|看板候補|絶対的看板娘|最高峰の美女|最高傑作|SSS級美女|完全未経験|完全業界未経験|動画撮影無料|動画即尺無料|動画即即無料|潮吹き＆動画無料|高級ソ〇プ出身|元CA|単体AV|18歳|撮影無料|即即|顔有動画無料|ハ〇撮り動画無料|三○悠亜似).*$/u, '')
    .replace(/ALLオプション無料$/u, '');
}

function jstNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function labelForDate(date) {
  const week = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}(${week})`;
}

function hhmm(value) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function aliasKeys(girl) {
  const aliases = new Set([normalizeName(girl.Name)]);
  for (const alias of String(girl.SearchName || '').split('｜')) {
    const key = normalizeName(alias);
    if (key) aliases.add(key);
  }
  return [...aliases].filter(Boolean);
}

async function readExistingProfiles() {
  try {
    const existing = JSON.parse(await fs.readFile('schedule.json', 'utf8'));
    return existing.profilesByName || {};
  } catch (error) {
    return {};
  }
}

async function apiFetch(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Venry API ${path} failed: ${response.status}`);
  return response.json();
}

async function login() {
  const username = process.env.VENRY_LOGIN_ID;
  const password = process.env.VENRY_PASSWORD;
  if (!username || !password) {
    throw new Error('VENRY_LOGIN_ID and VENRY_PASSWORD secrets are required.');
  }

  const response = await fetch(`${API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', username, password }),
  });
  if (!response.ok) throw new Error(`Venry login failed: ${response.status}`);
  const auth = await response.json();
  if (!auth.access_token) throw new Error('Venry login did not return an access token.');
  return auth.access_token;
}

function buildProfileMap(existingProfiles, girls, siteGirls) {
  const profilesByName = { ...existingProfiles };
  const existingKeys = new Set(Object.keys(existingProfiles));
  const existingKeyByLower = new Map(Object.keys(existingProfiles).map(key => [key.toLowerCase(), key]));
  const siteGirlByName = new Map();
  const siteKeyByLower = new Map();
  for (const siteGirl of siteGirls.filter(item => item.BaitaiCode === HEAVEN_BAITAI_CODE && item.SiteGirlId)) {
    const key = normalizeName(siteGirl.SiteGirlName);
    if (!siteGirlByName.has(key)) siteGirlByName.set(key, siteGirl);
    if (!siteKeyByLower.has(key.toLowerCase())) siteKeyByLower.set(key.toLowerCase(), key);
  }

  const girlById = new Map();
  for (const girl of girls) {
    const aliases = aliasKeys(girl);
    const existingKey = aliases.find(key => existingKeys.has(key)) || existingKeyByLower.get(aliases.find(key => existingKeyByLower.has(key.toLowerCase()))?.toLowerCase());
    const siteKey = aliases.find(key => siteGirlByName.has(key)) || siteKeyByLower.get(aliases.find(key => siteKeyByLower.has(key.toLowerCase()))?.toLowerCase());
    const key = existingKey || siteKey || aliases[0];
    const siteGirl = siteGirlByName.get(siteKey || key);
    const resolvedGirl = { ...girl, ResolvedName: existingProfiles[key]?.name || siteGirl?.SiteGirlName || girl.Name, ResolvedNameKey: key };
    girlById.set(String(girl.GirlId), resolvedGirl);
    if (siteGirl) {
      profilesByName[key] = {
        girlId: String(siteGirl.SiteGirlId),
        name: resolvedGirl.ResolvedName,
        profileUrl: `${HEAVEN_PROFILE_BASE}/girlid-${siteGirl.SiteGirlId}/?of=y2`,
      };
    }
  }

  return { profilesByName, girlById, siteGirlByName };
}

async function main() {
  const token = await login();
  const [existingProfiles, girlsData, siteGirls] = await Promise.all([
    readExistingProfiles(),
    apiFetch('/api/girls/list', token),
    apiFetch('/api/sitegirls', token),
  ]);
  const girls = girlsData.GirlsList || [];
  const { profilesByName, girlById, siteGirlByName } = buildProfileMap(existingProfiles, girls, siteGirls);

  const start = jstNow();
  start.setHours(0, 0, 0, 0);
  const dates = [];
  const castsByDate = {};

  for (let offset = 0; offset < 7; offset += 1) {
    const dateObj = addDays(start, offset);
    const date = formatDate(dateObj);
    dates.push({ date, label: labelForDate(dateObj) });

    const day = await apiFetch(`/api/schedules/1day?Range=${date}`, token);
    const casts = [];
    for (const schedule of day.ScheduleList || []) {
      if (schedule.ScheduleStatus !== 1 || !schedule.StartTime || !schedule.EndTime) continue;
      const girl = girlById.get(String(schedule.GirlId)) || (day.GirlsList || []).find(item => item.GirlId === schedule.GirlId);
      if (!girl) continue;
      const normalizedName = girl.ResolvedNameKey || normalizeName(girl.Name);
      const siteGirl = siteGirlByName.get(normalizedName);
      const profile = profilesByName[normalizedName];
      casts.push({
        girlId: String(siteGirl?.SiteGirlId || profile?.girlId || schedule.GirlId),
        venryGirlId: String(schedule.GirlId),
        name: profile?.name || girl.ResolvedName || girl.Name,
        normalizedName,
        profileUrl: profile?.profileUrl || '',
        time: `${hhmm(schedule.StartTime)}～${hhmm(schedule.EndTime)}`,
      });
    }
    castsByDate[date] = casts.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name, 'ja'));
  }

  const schedule = {
    source: 'Venry',
    sourcePages: [`${API_BASE}/api/schedules/1day`],
    syncedAt: new Date().toISOString(),
    dates,
    castsByDate,
    profilesByName,
  };

  await fs.writeFile('schedule.json', `${JSON.stringify(schedule, null, 2)}\n`);
  const total = Object.values(castsByDate).reduce((sum, casts) => sum + casts.length, 0);
  console.log(`Synced ${dates.length} dates and ${total} schedule entries from Venry.`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
