export function transliterateArabic(text) {
  const arabicMap = {
    أ: "a",
    ا: "a",
    إ: "i",
    آ: "aa",
    ب: "b",
    ت: "t",
    ث: "th",
    ج: "j",
    ح: "h",
    خ: "kh",
    د: "d",
    ذ: "dh",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "sh",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "gh",
    ف: "f",
    ق: "q",
    ك: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "w",
    ي: "y",
    ى: "a",
    ة: "a",
    ء: "a",
    ئ: "y",
    ؤ: "w",
  };

  return text
    .split("")
    .map((char) => arabicMap[char] || char) // check char in map if not not change 
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "") //  delete eny char not english or number  
    .toLowerCase();
}

///check if name is arabic
export function isArabic(text) {
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}