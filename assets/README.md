# NEON DASH — ספריית נכסים

כל הקבצים כאן הם SVG מקוריים שנוצרו לערכה הזו. יחידת הרשת היא **30px** (בלוק אחד = 30×30).
לתצוגה מהירה של הכול: פתחו את `preview.html` בדפדפן.

## מבנה

```
assets/
├── sprites/player/        דמויות: cube, cube-mini, ship, ball, ufo, wave, robot
├── sprites/obstacles/     spike, spike-mini, spike-triple, block, block-half, slope, saw, ground-tile
├── sprites/interactive/   pads, orbs, coin
├── sprites/portals/       פורטלי מצב, כבידה, גודל, מהירות
├── sprites/fx/            חלקיקים, פיצוץ, שובל
├── backgrounds/           bg-grid (tileable 300×300), bg-sunset (parallax)
├── ui/                    אייקונים, לוגו, פס התקדמות
├── audio/README.md        רשימת קבצי הסאונד הדרושים + מקורות חינמיים
├── levels/                level-01.json (שלב הדגמה) + level-schema.json
├── palette.json           פלטת הצבעים
└── preview.html           תצוגת כל הנכסים
```

## טבלת אובייקטים לשלבים

`t` הוא המזהה שנכנס לקובץ ה-JSON של השלב. `x` ו-`y` נמדדים ביחידות רשת; `y=0` = יושב על הרצפה.

| `t` | קובץ | גודל (בלוקים) | התנהגות | Hitbox |
|---|---|---|---|---|
| `spike` | obstacles/spike.svg | 1×1 | קטלני | משולש מוקטן ~0.4×0.5 במרכז התחתון |
| `spike-mini` | obstacles/spike-mini.svg | 1×0.5 | קטלני | ~0.4×0.25 |
| `spike-triple` | obstacles/spike-triple.svg | 3×1 | קטלני | שלושה hitbox נפרדים |
| `block` | obstacles/block.svg | 1×1 | מוצק — נחיתה מלמעלה, מוות מהצד | 1×1 מלא |
| `block-half` | obstacles/block-half.svg | 1×0.5 | מוצק | 1×0.5 |
| `slope` | obstacles/slope.svg | 1×1 | משופע — מחליק כלפי מעלה | משולש |
| `saw` | obstacles/saw.svg | 1.5×1.5 | קטלני, מסתובב | עיגול r≈0.55 בלוק |
| `ground` | obstacles/ground-tile.svg | 1×1 | רצפה (נפרש אוטומטית) | — |
| `pad-yellow` | interactive/pad-yellow.svg | 1×0.4 | קפיצה אוטומטית בגובה ~3.2 בלוקים | 1×0.4 |
| `pad-pink` | interactive/pad-pink.svg | 1×0.4 | קפיצה קטנה ~1.6 בלוקים | |
| `pad-blue` | interactive/pad-blue.svg | 1×0.4 | היפוך כבידה מיידי | |
| `pad-red` | interactive/pad-red.svg | 1×0.4 | קפיצה גבוהה ~4.5 בלוקים | |
| `orb-yellow` | interactive/orb-yellow.svg | 1×1 | בלחיצה: קפיצה רגילה (~2 בלוקים) | עיגול r=0.75 (נדיב) |
| `orb-pink` | interactive/orb-pink.svg | 1×1 | בלחיצה: קפיצה קטנה | |
| `orb-blue` | interactive/orb-blue.svg | 1×1 | בלחיצה: היפוך כבידה בלי שינוי מיקום | |
| `orb-green` | interactive/orb-green.svg | 1×1 | בלחיצה: קפיצה + היפוך כבידה | |
| `orb-red` | interactive/orb-red.svg | 1×1 | בלחיצה: קפיצה גבוהה | |
| `orb-dash` | interactive/orb-dash.svg | 1×1 | בהחזקה: זינוק בקו ישר עד שחרור/פגיעה | |
| `coin` | interactive/coin.svg | 1×1 | פריט אסיף (3 לשלב), נשמר ב-localStorage | עיגול r=0.5 |
| `portal-cube` … `portal-robot` | portals/ | 1×2 | החלפת מצב משחק | 1×2, מגע לא קטלני |
| `portal-gravity-up` / `-down` | portals/ | 1×2 | כבידה הפוכה / רגילה | |
| `portal-mini` / `portal-big` | portals/ | 1×2 | הקטנה (0.6) / חזרה לגודל רגיל | |
| `portal-dual` | portals/ | 1×2 | פיצול לשני שחקנים במראה | |
| `portal-mirror` | portals/ | 1×2 | היפוך כיוון תצוגה אופקי | |
| `speed-slow/normal/fast/faster` | portals/ | 1×1 | שינוי מהירות (0.807 / 1 / 1.243 / 1.502) | |
| `finish` | — | — | סוף השלב | קו וירטואלי |

## צביעה מחדש

כל קובץ משתמש בצבעי hex מפורשים מ-`palette.json`. להחלפת ערכת צבעים: חיפוש-והחלפה של ה-hex,
או טעינת ה-SVG כטקסט והזרקתו ל-DOM ואז שליטה ב-`fill` דרך CSS.

## רישוי

הנכסים נוצרו במיוחד עבור הפרויקט הזה ואינם מכילים גרפיקה, לוגו או שמות מ-Geometry Dash.
השם `NEON DASH` הוא שם עצמאי מוצע.
