const fs = require('node:fs/promises');

const SOURCE_URL = 'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/?of=y2';
const WEEKLY_PAGE_URLS = [
  SOURCE_URL,
  'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/weekly/2/?of=y2',
  'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/weekly/3/?of=y2',
  'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/weekly/4/?of=y2',
  'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/weekly/5/?of=y2',
  'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/weekly/6/?of=y2',
  'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/weekly/7/?of=y2',
  'https://www.cityheaven.net/osaka/A2702/A270203/kitty_osaka/attend/weekly/8/?of=y2',
];
const PROFILE_BASE_URL = 'https://www.cityheaven.net';

function stripTags(value) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return value
    .replace(/\s+/g, '')
    .replace(/\/(単体AV|即尺|元タレント).*$/u, '')
    .replace(/・(店長オススメ|極嬢|超逸材|超新星|未経験|極上|JK|元タレント|動画無料|激推し嬢|推姫|アイドル|憧れの美ギャル|全身性感帯|看板候補|絶対的看板娘|最高峰の美女|最高傑作|SSS級美女|完全未経験|完全業界未経験|動画撮影無料|動画即尺無料|動画即即無料|潮吹き＆動画無料|高級ソ〇プ出身|元CA|単体AV|18歳).*$/u, '')
    .replace(/ALLオプション無料$/u, '');
}

function resolveYear(month, now = new Date()) {
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const currentMonth = jst.getMonth() + 1;
  let year = jst.getFullYear();
  if (currentMonth === 12 && month === 1) year += 1;
  if (currentMonth === 1 && month === 12) year -= 1;
  return year;
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractDates(tableHtml) {
  const dates = [];
  const thPattern = /<th[^>]*class="week"[^>]*>([\s\S]*?)<\/th>/gi;
  for (const match of tableHtml.matchAll(thPattern)) {
    const label = stripTags(match[1]);
    const dateMatch = label.match(/(\d{1,2})\/(\d{1,2})\((.)\)/);
    if (!dateMatch) continue;
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);
    dates.push({
      date: formatDate(resolveYear(month), month, day),
      label,
    });
  }
  return dates;
}

function extractWorkTimes(tableHtml) {
  const secondRowMatch = tableHtml.match(/<tr>\s*<td[\s\S]*?<\/td>([\s\S]*?)<\/tr>/i);
  if (!secondRowMatch) return [];

  const cells = [];
  const tdPattern = /<td[^>]*width="110"[^>]*>([\s\S]*?)<\/td>/gi;
  for (const match of secondRowMatch[1].matchAll(tdPattern)) {
    const cellHtml = match[1];
    if (/class="holiday"/.test(cellHtml)) {
      cells.push('');
      continue;
    }
    const text = stripTags(cellHtml)
      .replace(/次回\s*\d{1,2}:\d{2}～/g, ' ')
      .replace(/受付終了/g, ' ')
      .replace(/\s*-\s*/g, '～');
    const ranges = [...text.matchAll(/(\d{1,2}:\d{2})\s*～\s*(\d{1,2}:\d{2})/g)];
    if (ranges.length === 0) {
      cells.push('');
      continue;
    }
    const range = ranges[ranges.length - 1];
    cells.push(`${range[1]}～${range[2]}`);
  }
  return cells;
}

function parseSchedule(html) {
  const tables = html.match(/<table border="0" cellspacing="1" cellpadding="0">[\s\S]*?<\/table>/g) || [];
  const castsByDate = {};
  const profilesByName = {};
  const datesByKey = {};

  for (const tableHtml of tables) {
    const girlMatch = tableHtml.match(/href="([^"]*girlid-(\d+)\/[^"]*)"/);
    if (!girlMatch) continue;

    const profileUrl = new URL(girlMatch[1].replace(/&amp;/g, '&'), PROFILE_BASE_URL).href;
    const girlId = girlMatch[2];
    const nameMatch = tableHtml.match(/<th[^>]*class="topbox"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const name = nameMatch ? stripTags(nameMatch[1]) : girlId;
    const normalizedName = normalizeName(name);
    const dates = extractDates(tableHtml);
    const workTimes = extractWorkTimes(tableHtml);

    profilesByName[normalizedName] = { girlId, name, profileUrl };

    dates.forEach((dateInfo, index) => {
      datesByKey[dateInfo.date] = dateInfo;
      const time = workTimes[index];
      if (!time) return;
      if (!castsByDate[dateInfo.date]) castsByDate[dateInfo.date] = [];
      castsByDate[dateInfo.date].push({
        girlId,
        name,
        normalizedName,
        profileUrl,
        time,
      });
    });
  }

  const dates = Object.values(datesByKey).sort((a, b) => a.date.localeCompare(b.date));
  for (const date of Object.keys(castsByDate)) {
    castsByDate[date].sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name, 'ja'));
  }

  return {
    source: WEEKLY_PAGE_URLS[0],
    sourcePages: WEEKLY_PAGE_URLS,
    syncedAt: new Date().toISOString(),
    dates,
    castsByDate,
    profilesByName,
  };
}

async function main() {
  const headers = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
  };
  const htmlPages = [];
  for (const url of WEEKLY_PAGE_URLS) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    htmlPages.push(await response.text());
  }

  const schedule = parseSchedule(htmlPages.join('\n'));
  await fs.writeFile('schedule.json', `${JSON.stringify(schedule, null, 2)}\n`);
  console.log(`Synced ${schedule.dates.length} dates from ${Object.keys(schedule.profilesByName).length} profiles.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
