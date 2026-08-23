import os

target = "script.js"
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    'لا توجد نتائج': 'No results found',
    'مشاهدة الآن': 'Watch Now',
    'التفاصيل': 'Details',
    "'مسلسل'": "'Series'",
    "'فيلم'": "'Movie'",
    'لا يوجد وصف متاح.': 'No description available.',
    'في القائمة': 'In List',
    'قائمتي': 'My List',
    'جاري التحميل...': 'Loading...',
    'جاري تحميل الحلقات...': 'Loading episodes...',
    'أجزاء وأعمال مشابهة': 'Similar Parts & Works',
    'الموسم ': 'Season ',
    'الحلقة ': 'Episode ',
    'البطل سيفوز بالمعركة': 'Hero wins the battle',
    'انفجار كبير سيحدث': 'A huge explosion will occur',
    'ظهور عدو جديد': 'A new enemy appears',
    'سيظهر وحش مخيف!': 'A scary monster will appear!',
    'شخصية ستموت فجأة': 'A character will die suddenly',
    'فخ خطير غير متوقع': 'Unexpected dangerous trap',
    'تم التوقع!': 'Predicted!',
    'الممثلون': 'Cast',
    'المواسم والحلقات': 'Seasons & Episodes',
    ' حلقة<': ' episodes<',
    'لا توجد حلقات.': 'No episodes found.',
    ' دقيقة<': ' min<',
    'جاري...': 'Loading...',
    'أنت في الحلقة الأخيرة المتوفرة.': 'This is the last available episode.',
    'التالية ': 'Next ',
    ' السابقة': ' Prev',
    'اكتب للبحث في ملايين الأفلام...': 'Type to search millions of titles...',
    'جاري البحث...': 'Searching...',
    'متابعة المشاهدة': 'Continue Watching',
    'مسح الكل': 'Clear All',
    "'أفلام'": "'Movies'",
    "'مسلسلات'": "'Series'",
    "'أنمي'": "'Anime'",
    "'سينما آسيوية'": "'Asian Cinema'",
    "'الأكثر رواجاً'": "'Trending'",
    "'جديد الأسبوع'": "'New This Week'",
    "'أعلى تقييماً'": "'Top Rated'",
    "'مسلسلات شهيرة'": "'Popular Series'",
    "'أكشن ومغامرة'": "'Action & Adventure'",
    "'خيال علمي'": "'Sci-Fi'",
    "'رعب'": "'Horror'",
    "'كوميديا'": "'Comedy'",
    "'رومانسي'": "'Romance'",
    "'أفلام صينية'": "'Chinese Movies'",
    "'أفلام يابانية'": "'Japanese Movies'",
    "'دراما كورية'": "'Korean Drama'",
    "language=ar-SA": "language=en-US",
    "with_original_language=ar": "with_original_language=en"
}

for ar, en in replacements.items():
    content = content.replace(ar, en)

with open(target, "w", encoding="utf-8") as f:
    f.write(content)
print("JavaScript translation complete.")
