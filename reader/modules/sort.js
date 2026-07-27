// --- Robust Sorting Logic ---

export function parseChineseNumeral(text) {
  const digitMap = {
    零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4,
    五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
    十: 10, 百: 100, 千: 1000
  };

  if (/^\d+$/.test(text)) return parseInt(text, 10);

  if (text === "十") return 10;

  let val = 0;
  let temp = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const num = digitMap[char];

    if (num === undefined) return NaN;

    if (num === 10 || num === 100 || num === 1000) {
      val += (temp === 0 ? 1 : temp) * num;
      temp = 0;
    } else {
      temp = num;
    }
  }
  val += temp;
  return val;
}

export function extractOrder(text) {
  const filename = text.split("/").pop();
  const leadingNumMatch = filename.match(/^(\d+)/);
  if (leadingNumMatch) return parseInt(leadingNumMatch[1], 10);

  const match = filename.match(/第([0-9零一二三四五六七八九十兩〇百千]+)[章卷]/);

  if (!match) return Number.MAX_VALUE;
  const num = parseChineseNumeral(match[1]);
  return isNaN(num) ? Number.MAX_VALUE : num;
}

export function naturalSort(a, b) {
  const dirA = a.substring(0, a.lastIndexOf("/"));
  const dirB = b.substring(0, b.lastIndexOf("/"));

  if (dirA !== dirB) {
    const volA = extractOrder(dirA);
    const volB = extractOrder(dirB);
    if (volA !== volB && volA !== Number.MAX_VALUE && volB !== Number.MAX_VALUE) {
      return volA - volB;
    }
    return dirA.localeCompare(dirB, "zh-Hant");
  }

  const orderA = extractOrder(a);
  const orderB = extractOrder(b);

  if (orderA !== orderB && orderA !== Number.MAX_VALUE && orderB !== Number.MAX_VALUE) {
    return orderA - orderB;
  }

  return a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" });
}

export function countWords(text) {
  return (text.match(/\S/g) || []).length;
}
