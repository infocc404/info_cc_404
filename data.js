// ============================================================================
// info cc 404 — Timetable & Group Teachers Data (data.js)
// TimeTable ING1 Sem 1 (2026-2027) — Ingénieur d'État en Informatique
// ============================================================================

// 1. قائمة المقاييس السبعة المعتمدة رسمياً في السداسي 1
const SUBJECTS = [
  {
    id: "algo",
    nameFr: "Algo & SDS 1",
    nameAr: "الخوارزميات وهياكل المعطيات 1",
    lectureTeacher: "Mrs Bachir",
    aliases: [
      "algo", "algo 1", "algorithmique", "sds", "sds 1", "algo & sds",
      "algo & sds 1", "asd", "asd1", "structures de données", "الخوارزميات"
    ]
  },
  {
    id: "arch",
    nameFr: "Comp Arch 1",
    nameAr: "بنية الحاسوب 1",
    lectureTeacher: "Mr Guezouli",
    aliases: [
      "arch", "arch 1", "comp arch", "comp arch 1", "architecture",
      "archi", "architecture des ordinateurs", "بنية الحاسوب"
    ]
  },
  {
    id: "sys",
    nameFr: "Operating Sys 1",
    nameAr: "نظام التشغيل 1",
    lectureTeacher: "Mrs Saadi",
    aliases: [
      "sys", "sys 1", "operating sys", "operating sys 1", "systeme",
      "systemes", "système", "os", "se", "système d'exploitation", "نظام التشغيل"
    ]
  },
  {
    id: "analyse",
    nameFr: "Math Analysis 1",
    nameAr: "التحليل الرياضي 1",
    lectureTeacher: "Mr Ramdani",
    aliases: [
      "analyse", "analyse 1", "analysis", "math analysis", "math analysis 1",
      "maths", "math 1", "التحليل", "التحليل الرياضي"
    ]
  },
  {
    id: "algebre",
    nameFr: "Algebra 1",
    nameAr: "الجبر 1",
    lectureTeacher: "Mrs Boudherssa",
    aliases: [
      "algebre", "algèbre", "algebre 1", "algèbre 1", "algebra",
      "algebra 1", "الجبر", "الجبر 1"
    ]
  },
  {
    id: "elec",
    nameFr: "Fundamental Electronics",
    nameAr: "الإلكترونيك الأساسية",
    lectureTeacher: "Mrs Hasrouri",
    aliases: [
      "elec", "electronique", "électronique", "electronics",
      "fundamental electronics", "elec fond", "الإلكترونيك", "الكترونيك"
    ]
  },
  {
    id: "histoire",
    nameFr: "History of Algeria",
    nameAr: "تاريخ الجزائر",
    lectureTeacher: "Mr Bekhouche",
    aliases: [
      "histoire", "histoire d'algerie", "histoire de l'algerie",
      "history", "history of algeria", "تاريخ", "تاريخ الجزائر"
    ]
  }
];

// 2. أساتذة وقاعات الـ TD والـ TP لكل فوج (G1 إلى G10)
// ملاحظة: مادة تاريخ الجزائر لا تحتوي على TD أو TP (Cours فقط).
// مادة التحليل والجبر تحتوي على TD فقط ولا تحتوي على TP.
const GROUP_TEACHERS = {
  1: {
    algo: { td: "Mrs Bachir", tdRoom: "Salle 101", tp: "Mr Dahmani", tpRoom: "Lab Info 1" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 102", tp: "Mr Guezouli", tpRoom: "Lab Micro 1" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 103", tp: "Mrs Saadi", tpRoom: "Lab 02" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 104", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 101", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 102", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 1" },
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  2: {
    algo: { td: "Mr Dahmani", tdRoom: "Salle 103", tp: "Mr Dahmani", tpRoom: "Lab Info 2" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 104", tp: "Mr Guezouli", tpRoom: "Lab Micro 1" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 105", tp: "Mrs Saadi", tpRoom: "Lab 01" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 102", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 105", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 103", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 1" }, // TODO verify: maintenance overlap
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  3: {
    algo: { td: "Mrs Bachir", tdRoom: "Salle 106", tp: "Mrs Bachir", tpRoom: "Lab Info 3" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 101", tp: "Mr Guezouli", tpRoom: "Lab Micro 2" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 102", tp: "Mrs Saadi", tpRoom: "Lab 03" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 107", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 104", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 106", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 2" },
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  4: {
    algo: { td: "Mr Dahmani", tdRoom: "Salle 107", tp: "Mrs Bachir", tpRoom: "Lab Info 3" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 108", tp: "Mr Guezouli", tpRoom: "Lab Micro 2" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 104", tp: "Mrs Saadi", tpRoom: "Lab 02" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 105", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 103", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 108", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 1" },
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  5: {
    algo: { td: "Mrs Bachir", tdRoom: "Salle 109", tp: "Mr Dahmani", tpRoom: "Lab Info 1" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 106", tp: "Mr Guezouli", tpRoom: "Lab Micro 1" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 109", tp: "Mrs Saadi", tpRoom: "Lab 04" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 108", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 107", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 105", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 2" },
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  6: {
    algo: { td: "Mrs Bachir", tdRoom: "Salle 110", tp: "Mr Dahmani", tpRoom: "Lab Info 2" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 110", tp: "Mr Guezouli", tpRoom: "Lab Micro 2" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 107", tp: "Mrs Saadi", tpRoom: "Lab 01" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 103", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 109", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 110", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 2" }, // TODO verify: missing day in printout
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  7: {
    algo: { td: "Mr Dahmani", tdRoom: "Salle 111", tp: "Mrs Bachir", tpRoom: "Lab Info 1" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 111", tp: "Mr Guezouli", tpRoom: "Lab Micro 1" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 108", tp: "Mrs Saadi", tpRoom: "Lab 03" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 109", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 106", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 111", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 1" },
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  8: {
    algo: { td: "Mrs Bachir", tdRoom: "Salle 112", tp: "Mr Dahmani", tpRoom: "Lab Info 3" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 112", tp: "Mr Guezouli", tpRoom: "Lab Micro 2" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 110", tp: "Mrs Saadi", tpRoom: "Lab 02" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 111", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 112", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 107", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 2" },
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  9: {
    algo: { td: "Mr Dahmani", tdRoom: "Salle 113", tp: "Mr Dahmani", tpRoom: "Lab Info 2" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 114", tp: "Mr Guezouli", tpRoom: "Lab Micro 1" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 112", tp: "Mrs Saadi", tpRoom: "Lab 04" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 113", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 110", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 114", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 3" },
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  },
  10: {
    algo: { td: "Mrs Bachir", tdRoom: "Salle 115", tp: "Mrs Bachir", tpRoom: "Lab Info 3" },
    arch: { td: "Mr Guezouli", tdRoom: "Salle 115", tp: "Mr Guezouli", tpRoom: "Lab Micro 2" },
    sys: { td: "Mrs Saadi", tdRoom: "Salle 114", tp: "Mrs Saadi", tpRoom: "Lab 01" },
    analyse: { td: "Mr Ramdani", tdRoom: "Salle 115", tp: null, tpRoom: null },
    algebre: { td: "Mrs Boudherssa", tdRoom: "Salle 113", tp: null, tpRoom: null },
    elec: { td: "Mrs Hasrouri", tdRoom: "Salle 115", tp: "Mrs Hasrouri", tpRoom: "Lab Elec 3" }, // TODO verify: unconfirmed lab slot
    histoire: { td: null, tdRoom: null, tp: null, tpRoom: null }
  }
};

// 3. جدول برنامج الحصص العام (General Timetable Table) المعروض في صفحة الأفواج
// الأعمدة: الأحد..الخميس، والفترات الزمنية 08:30-10:00, 10:00-11:30, استراحة الغداء, 12:30-14:00, 14:00-15:30
const TIMETABLE = {
  days: ["الأحد (Dim)", "الإثنين (Lun)", "الثلاثاء (Mar)", "الأربعاء (Mer)", "الخميس (Jeu)"],
  slots: [
    {
      time: "08:30 - 10:00",
      cells: [
        { subject: "Cours Algo & SDS 1", teacher: "Mrs Bachir", room: "Amphi A" },
        { subject: "Cours Comp Arch 1", teacher: "Mr Guezouli", room: "Amphi A" },
        { subject: "Cours Math Analysis 1", teacher: "Mr Ramdani", room: "Amphi B" },
        { subject: "Cours Operating Sys 1", teacher: "Mrs Saadi", room: "Amphi A" },
        { subject: "Cours Fundamental Elec", teacher: "Mrs Hasrouri", room: "Amphi A" }
      ]
    },
    {
      time: "10:00 - 11:30",
      cells: [
        { subject: "TD Algo (G1/G2/G3)", teacher: "Salles 101/103/106", room: "Salles TD" },
        { subject: "TD Arch (G1/G3/G5)", teacher: "Salles 102/101/106", room: "Salles TD" },
        { subject: "TD Analyse (G1/G4/G7)", teacher: "Salles 104/105/109", room: "Salles TD" },
        { subject: "Cours Algebra 1", teacher: "Mrs Boudherssa", room: "Amphi B" },
        { subject: "TD Elec (G1/G4/G8)", teacher: "Salles 102/108/107", room: "Salles TD" }
      ]
    },
    // استراحة الغداء (Lunch Break)
    {
      isLunch: true,
      time: "11:30 - 12:30",
      label: "استراحة الغداء (Pause Déjeuner)"
    },
    {
      time: "12:30 - 14:00",
      cells: [
        { subject: "TP Sys / TP Algo (G1/G4)", teacher: "Lab 02 / Lab 03", room: "Labs" },
        { subject: "Cours Histoire d'Algérie", teacher: "Mr Bekhouche", room: "Amphi C" }, // TODO verify: time slot in PDF
        { subject: "TP Arch / TP Elec (G3/G6)", teacher: "Lab Micro 2 / Lab Elec 2", room: "Labs" },
        { subject: "TD Algebra (G2/G5/G8)", teacher: "Salles 105/107/112", room: "Salles TD" },
        { subject: "TP Sys / TP Elec (G2/G5)", teacher: "Lab 01 / Lab Elec 2", room: "Labs" }
      ]
    },
    {
      time: "14:00 - 15:30",
      cells: [
        { subject: "TP Algo (G2/G6)", teacher: "Lab Info 2", room: "Lab" },
        { subject: "-", teacher: "-", room: "-" },
        { subject: "TP Sys (G9)", teacher: "Lab 04", room: "Lab" },
        { subject: "-", teacher: "-", room: "-" },
        { subject: "Cours Histoire (Rattrapage)", teacher: "Mr Bekhouche", room: "Amphi C" } // TODO verify
      ]
    }
  ]
};

// إتاحة البيانات في window
if (typeof window !== "undefined") {
  window.SUBJECTS = SUBJECTS;
  window.GROUP_TEACHERS = GROUP_TEACHERS;
  window.TIMETABLE = TIMETABLE;
}
