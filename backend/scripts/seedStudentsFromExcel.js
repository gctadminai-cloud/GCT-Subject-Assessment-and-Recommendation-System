/**
 * Seed Script: Legacy Student Accounts (from Registrar's Excel file, USERS_updated.xlsx)
 * ------------------------------------------------------------------------------------
 * All 250 records are embedded directly below (studentId, password, fullName, program) —
 * nothing is read from the spreadsheet at runtime, per request.
 *
 * Each student becomes:
 *   1. A row in `students`  — verified = true (legacy/official record, no ID photos needed)
 *   2. A row in `accounts`  — password_hash = bcrypt(original Excel password),
 *                             role = 'student', status = 'approved',
 *                             bulk_imported = true
 *
 * bulk_imported = true is what makes these accounts SURVIVE the weekly reset job
 * (backend/cron/weeklyReset.js), which deletes student accounts weekly but now
 * skips any account where bulk_imported = true.
 *
 * Run once:
 *   node backend/scripts/seedStudentsFromExcel.js
 * Safe to re-run — upserts on student_id / username, so already-seeded rows are
 * just updated in place, never duplicated.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

const STUDENTS = [
  {
    "studentId": "10094",
    "password": "bhcwQ",
    "fullName": "ABAYON, CYRA MAE",
    "program": "BSIT"
  },
  {
    "studentId": "10526",
    "password": "uWfCKx",
    "fullName": "ABAYON, CHIN-CHIN",
    "program": "BSIT"
  },
  {
    "studentId": "9364",
    "password": "2qr99",
    "fullName": "ABELLO JR., JEMCIE",
    "program": "BSIT"
  },
  {
    "studentId": "11133",
    "password": "NHv8hK",
    "fullName": "ACUPIO, JERICHO",
    "program": "BSIT"
  },
  {
    "studentId": "11293",
    "password": "FOAnNc",
    "fullName": "AGUIRRE, AL",
    "program": "BSIT"
  },
  {
    "studentId": "11454",
    "password": "kCd6v",
    "fullName": "AGUIRRE, JHON LUIS",
    "program": "BSIT"
  },
  {
    "studentId": "10098",
    "password": "Tz6k",
    "fullName": "ALBINO, CARL ALLEN VICTOR",
    "program": "BSIT"
  },
  {
    "studentId": "11082",
    "password": "4jmex",
    "fullName": "ALFARO, DANICA",
    "program": "BSIT"
  },
  {
    "studentId": "10169",
    "password": "RwO1",
    "fullName": "ALFONSO, LYCA",
    "program": "BSIT"
  },
  {
    "studentId": "10426",
    "password": "r2UI5",
    "fullName": "ALMENE, KEN JOSHUA",
    "program": "BSIT"
  },
  {
    "studentId": "9328",
    "password": "Q7dJ",
    "fullName": "ALTURA, GEM ALFER",
    "program": "BSIT"
  },
  {
    "studentId": "10949",
    "password": "AeyQ",
    "fullName": "AMARADO, ZEMBER IVAN",
    "program": "BSIT"
  },
  {
    "studentId": "10158",
    "password": "NUgOCh",
    "fullName": "AMOR, JULIA",
    "program": "BSIT"
  },
  {
    "studentId": "11054",
    "password": "4Oiu",
    "fullName": "ANTARAN, JOHANNAH MAE",
    "program": "BSIT"
  },
  {
    "studentId": "9302",
    "password": "2JRcP",
    "fullName": "AQUINO, JULIUS",
    "program": "BSIT"
  },
  {
    "studentId": "10315",
    "password": "13uZ",
    "fullName": "ARAPAN, CHRIS KYLE",
    "program": "BSIT"
  },
  {
    "studentId": "9355",
    "password": "Pgy1",
    "fullName": "ARBOLEDA, CHARDRIC",
    "program": "BSIT"
  },
  {
    "studentId": "9446",
    "password": "fR0Ft",
    "fullName": "ARTOCILLA, PATRICIA MAE",
    "program": "BSIT"
  },
  {
    "studentId": "11022",
    "password": "cewzd",
    "fullName": "BALAGTAS, JOHN CHRISTOPHER",
    "program": "BSIT"
  },
  {
    "studentId": "11238",
    "password": "5Xqv",
    "fullName": "BALLESTER, KEAN GABRIEL",
    "program": "BSIT"
  },
  {
    "studentId": "12021",
    "password": "jaAI",
    "fullName": "BALTAZAR, VINCENT LOUISE",
    "program": "BSIT"
  },
  {
    "studentId": "11334",
    "password": "WLuGZx",
    "fullName": "BALUYUT, JOHN MARK DIGER",
    "program": "BSIT"
  },
  {
    "studentId": "9557",
    "password": "mpzpj",
    "fullName": "BANTIGUE, FRANZ ALDRIN",
    "program": "BSIT"
  },
  {
    "studentId": "12022",
    "password": "WIB9",
    "fullName": "BARTE, MARK CHESTER",
    "program": "BSIT"
  },
  {
    "studentId": "10886",
    "password": "Y5Gk47",
    "fullName": "BARTOLOME, JOHN DAVID",
    "program": "BSIT"
  },
  {
    "studentId": "11214",
    "password": "BL5dG",
    "fullName": "BAUTISTA, JERICHO MARI",
    "program": "BSIT"
  },
  {
    "studentId": "11895",
    "password": "heMS",
    "fullName": "BAUTISTA, CHRISTIAN JAY",
    "program": "BSIT"
  },
  {
    "studentId": "11953",
    "password": "Wal9",
    "fullName": "BAUTISTA, JUDE BERNARD",
    "program": "BSIT"
  },
  {
    "studentId": "9084",
    "password": "a1IkSV",
    "fullName": "BAYLAS, VINCE CHRISTIAN",
    "program": "BSIT"
  },
  {
    "studentId": "11582",
    "password": "D09geL",
    "fullName": "BAYONA, HANS",
    "program": "BSIT"
  },
  {
    "studentId": "11473",
    "password": "8e9I",
    "fullName": "BELETA, MYRINE",
    "program": "BSIT"
  },
  {
    "studentId": "11158",
    "password": "AYyfl",
    "fullName": "BELINARIO, CYRILL VICTOR",
    "program": "BSIT"
  },
  {
    "studentId": "11768",
    "password": "QQeqIW",
    "fullName": "BERANO, JAY SPENCER",
    "program": "BSIT"
  },
  {
    "studentId": "10626",
    "password": "o2sB",
    "fullName": "BERNAL, KEZIAH FAITH",
    "program": "BSIT"
  },
  {
    "studentId": "11712",
    "password": "UG9w",
    "fullName": "BERNALDO, ROSEBEL",
    "program": "BSIT"
  },
  {
    "studentId": "9233",
    "password": "Yv1NiQ",
    "fullName": "BODEGAS, KITZ",
    "program": "BSIT"
  },
  {
    "studentId": "9254",
    "password": "Di4ibW",
    "fullName": "BONTES, SCOTT",
    "program": "BSIT"
  },
  {
    "studentId": "11552",
    "password": "8YyKF",
    "fullName": "BUNCARAS, DANIEL",
    "program": "BSIT"
  },
  {
    "studentId": "10328",
    "password": "Sovt",
    "fullName": "BUSTAMANTE, NIKKO",
    "program": "BSIT"
  },
  {
    "studentId": "10978",
    "password": "Zo1eWZ",
    "fullName": "CABALDA, RECCA ANN",
    "program": "BSIT"
  },
  {
    "studentId": "10010",
    "password": "borF9",
    "fullName": "CABATU, CHRISTIAN JAY",
    "program": "BSIT"
  },
  {
    "studentId": "11470",
    "password": "kboX",
    "fullName": "CADAHING, ANGLO",
    "program": "BSIT"
  },
  {
    "studentId": "11635",
    "password": "Yb2B",
    "fullName": "CANDOLITA, DAVE",
    "program": "BSIT"
  },
  {
    "studentId": "9365",
    "password": "rCShPD",
    "fullName": "CANTILA, RACHEL",
    "program": "BSIT"
  },
  {
    "studentId": "11471",
    "password": "rxTx",
    "fullName": "CASIMERO, MIANNE",
    "program": "BSIT"
  },
  {
    "studentId": "9508",
    "password": "69ixuY",
    "fullName": "CASTILLON, RYCHE MYRON",
    "program": "BSIT"
  },
  {
    "studentId": "10965",
    "password": "mSRi",
    "fullName": "CAWALING, IZAJ MELIZ",
    "program": "BSIT"
  },
  {
    "studentId": "11617",
    "password": "W1yt",
    "fullName": "CAWALING, GRACEL",
    "program": "BSIT"
  },
  {
    "studentId": "11791",
    "password": "eBxwpH",
    "fullName": "CHOCO, RALPH ANTHONY",
    "program": "BSIT"
  },
  {
    "studentId": "12037",
    "password": "NHrhny",
    "fullName": "CIPRIANO, RHEA RHUZ",
    "program": "BSIT"
  },
  {
    "studentId": "11032",
    "password": "POT8",
    "fullName": "COCOY, EARL JOSHUA",
    "program": "BSIT"
  },
  {
    "studentId": "11169",
    "password": "hACv8L",
    "fullName": "COLAS, REYMAR",
    "program": "BSIT"
  },
  {
    "studentId": "8856",
    "password": "0VgYRz",
    "fullName": "COMPUESTO, LORRAINE MARIE",
    "program": "BSIT"
  },
  {
    "studentId": "10782",
    "password": "59tM",
    "fullName": "CRISPIN, CHRISTOPHER JOSHUEN",
    "program": "BSIT"
  },
  {
    "studentId": "11013",
    "password": "1pjDz4",
    "fullName": "CUSTODIO, CAVIN RAFAEL",
    "program": "BSIT"
  },
  {
    "studentId": "11742",
    "password": "6RHY6",
    "fullName": "DAGUNO, JOHN CARLO",
    "program": "BSIT"
  },
  {
    "studentId": "11518",
    "password": "Bu716",
    "fullName": "DALISAY, MYKA ROSE",
    "program": "BSIT"
  },
  {
    "studentId": "9064",
    "password": "nrAM4g",
    "fullName": "DAVID, HEAVENSENT",
    "program": "BSIT"
  },
  {
    "studentId": "11397",
    "password": "V9ykcK",
    "fullName": "DE GUZMAN, DEZIO RODEO",
    "program": "BSIT"
  },
  {
    "studentId": "11036",
    "password": "LQbb1",
    "fullName": "DE JESUS, CHRISTIAN",
    "program": "BSIT"
  },
  {
    "studentId": "10916",
    "password": "Je3QJ",
    "fullName": "DE LEON, KOBE",
    "program": "BSIT"
  },
  {
    "studentId": "11655",
    "password": "4muav",
    "fullName": "DE PEDRO, PRINCE JUNIELLE",
    "program": "BSIT"
  },
  {
    "studentId": "9468",
    "password": "uy3H0",
    "fullName": "DEFENSOR, JOGIE",
    "program": "BSIT"
  },
  {
    "studentId": "8694",
    "password": "6t3OsY",
    "fullName": "DELA CRUZ, JADE",
    "program": "BSIT"
  },
  {
    "studentId": "9055",
    "password": "F00p6",
    "fullName": "DELA CRUZ, CHRISMER",
    "program": "BSIT"
  },
  {
    "studentId": "9172",
    "password": "SVKPmH",
    "fullName": "DELA ROSA, JESSA",
    "program": "BSIT"
  },
  {
    "studentId": "9433",
    "password": "Ua3G",
    "fullName": "DELIGENCIA, NICOLE",
    "program": "BSIT"
  },
  {
    "studentId": "9025",
    "password": "2dAgd",
    "fullName": "DIZON, ARA",
    "program": "BSIT"
  },
  {
    "studentId": "10960",
    "password": "NO1Ez7",
    "fullName": "DOLENDO, LOUISE VOISER",
    "program": "BSIT"
  },
  {
    "studentId": "11972",
    "password": "31SSGG",
    "fullName": "DOMINGO, FLUNITO",
    "program": "BSIT"
  },
  {
    "studentId": "9284",
    "password": "YP2V",
    "fullName": "DORIA, MARK CHRISTIAN",
    "program": "BSIT"
  },
  {
    "studentId": "11241",
    "password": "AxRT",
    "fullName": "DURAN, PAULINE",
    "program": "BSIT"
  },
  {
    "studentId": "10792",
    "password": "CsENl",
    "fullName": "ELESERIO, CHRISTIAN DAVE",
    "program": "BSIT"
  },
  {
    "studentId": "11463",
    "password": "Lm3dOt",
    "fullName": "EMEN, JONAH FAITH",
    "program": "BSIT"
  },
  {
    "studentId": "8031",
    "password": "SXvKch",
    "fullName": "ENALPE, RODOLFO",
    "program": "BSIT"
  },
  {
    "studentId": "10696",
    "password": "GUd6",
    "fullName": "ENGALING, MAYNARD",
    "program": "BSIT"
  },
  {
    "studentId": "11459",
    "password": "Nsw7",
    "fullName": "EPIL, ALTEA MAE",
    "program": "BSIT"
  },
  {
    "studentId": "9089",
    "password": "7JGM",
    "fullName": "ESLOMOT, JOYLYN",
    "program": "BSIT"
  },
  {
    "studentId": "10238",
    "password": "MHWm",
    "fullName": "ESPIRITU, KEVIN ANGELO",
    "program": "BSIT"
  },
  {
    "studentId": "11843",
    "password": "MNU2Ts",
    "fullName": "ESTOSATA, MARK GIL",
    "program": "BSIT"
  },
  {
    "studentId": "11480",
    "password": "BqaZTm",
    "fullName": "ESTREVELLO, LOU JEAN",
    "program": "BSIT"
  },
  {
    "studentId": "11681",
    "password": "z0jQYl",
    "fullName": "FAUSTINO, RON DAVE",
    "program": "BSIT"
  },
  {
    "studentId": "11141",
    "password": "6IPcO7",
    "fullName": "FERNANDEZ, SHENALYZIEL",
    "program": "BSIT"
  },
  {
    "studentId": "12047",
    "password": "MSLFXw",
    "fullName": "FERNANDEZ, APPLE JOY",
    "program": "BSIT"
  },
  {
    "studentId": "9381",
    "password": "6doA8i",
    "fullName": "FERNANDO, KEITH COLBY",
    "program": "BSIT"
  },
  {
    "studentId": "10063",
    "password": "s24amK",
    "fullName": "FERNANDO, JULES JUSTINE",
    "program": "BSIT"
  },
  {
    "studentId": "10824",
    "password": "S5IT8",
    "fullName": "FERNANDO, YURI",
    "program": "BSIT"
  },
  {
    "studentId": "11961",
    "password": "OnmKGP",
    "fullName": "FERNANDO, ELIZABETH",
    "program": "BSIT"
  },
  {
    "studentId": "11261",
    "password": "Gd0am",
    "fullName": "FIGUEROA, CHRISTIAN",
    "program": "BSIT"
  },
  {
    "studentId": "11509",
    "password": "sALt",
    "fullName": "FILIO, ANAVHIA AGUSTINA",
    "program": "BSIT"
  },
  {
    "studentId": "10335",
    "password": "R6Y3rW",
    "fullName": "FLOGIO, ANGELLA",
    "program": "BSIT"
  },
  {
    "studentId": "9189",
    "password": "ZKwj",
    "fullName": "FLORES, MARICAR",
    "program": "BSIT"
  },
  {
    "studentId": "9344",
    "password": "vJ6Kl",
    "fullName": "FLORES, KEN CARLA",
    "program": "BSIT"
  },
  {
    "studentId": "11067",
    "password": "WWk1",
    "fullName": "FLORES, ALBERT",
    "program": "BSIT"
  },
  {
    "studentId": "11289",
    "password": "RQt3C",
    "fullName": "FLORES, ELGIE",
    "program": "BSIT"
  },
  {
    "studentId": "11290",
    "password": "XkOE",
    "fullName": "FLORES, NOELLA MARIE",
    "program": "BSIT"
  },
  {
    "studentId": "10703",
    "password": "MbBQ",
    "fullName": "FRANCISCO, LANI",
    "program": "BSIT"
  },
  {
    "studentId": "9478",
    "password": "iUh2r",
    "fullName": "FULGENCIO, CRISTY",
    "program": "BSIT"
  },
  {
    "studentId": "11556",
    "password": "OvRv4",
    "fullName": "GABINETE, RON JOSEPH",
    "program": "BSIT"
  },
  {
    "studentId": "11698",
    "password": "DASFg",
    "fullName": "GALAN, MIKE",
    "program": "BSIT"
  },
  {
    "studentId": "9505",
    "password": "ieqmc",
    "fullName": "GARCIA, FRANCIS JOSEPH",
    "program": "BSIT"
  },
  {
    "studentId": "11741",
    "password": "GrP0",
    "fullName": "GELLANGCANAO, JOHN CYRIL",
    "program": "BSIT"
  },
  {
    "studentId": "11458",
    "password": "zNR0",
    "fullName": "GINOY, SHEAN GHIN SID",
    "program": "BSIT"
  },
  {
    "studentId": "11407",
    "password": "ofpl2t",
    "fullName": "GONZALES, DARREL",
    "program": "BSIT"
  },
  {
    "studentId": "8813",
    "password": "7ZH6",
    "fullName": "GREGORIO, ZHANDRE DEX",
    "program": "BSIT"
  },
  {
    "studentId": "9860",
    "password": "ab9Id",
    "fullName": "GUBATON, ALEXSANDRA",
    "program": "BSIT"
  },
  {
    "studentId": "10467",
    "password": "hxuV",
    "fullName": "IGUIN, MICHELLE",
    "program": "BSIT"
  },
  {
    "studentId": "8262",
    "password": "LARLd",
    "fullName": "ILEDAN, CHERRY LYN",
    "program": "BSIT"
  },
  {
    "studentId": "8520",
    "password": "xGKnj",
    "fullName": "ILISAN, JOHN LEE",
    "program": "BSIT"
  },
  {
    "studentId": "11684",
    "password": "26EN",
    "fullName": "IMPERIAL, MICHAEL",
    "program": "BSIT"
  },
  {
    "studentId": "11629",
    "password": "7nOhPI",
    "fullName": "INAMARGA, KYLE ANDRIE",
    "program": "BSIT"
  },
  {
    "studentId": "11052",
    "password": "2pme",
    "fullName": "IQUIÑA, ASHLEY YIEXIEN",
    "program": "BSIT"
  },
  {
    "studentId": "11574",
    "password": "oiEoj",
    "fullName": "IRADER, CAMILLE",
    "program": "BSIT"
  },
  {
    "studentId": "11976",
    "password": "86CN",
    "fullName": "ISLAO, CEA JHAY",
    "program": "BSIT"
  },
  {
    "studentId": "11097",
    "password": "ov3h",
    "fullName": "JAPITAN, NICCA ELLA",
    "program": "BSIT"
  },
  {
    "studentId": "12034",
    "password": "f0WVA",
    "fullName": "LAGO, JANNA LOUISE",
    "program": "BSIT"
  },
  {
    "studentId": "11777",
    "password": "Lqahkz",
    "fullName": "LALATA, GIAN HENRY",
    "program": "BSIT"
  },
  {
    "studentId": "11773",
    "password": "hmlAg",
    "fullName": "LAROZA, RENZO",
    "program": "BSIT"
  },
  {
    "studentId": "9286",
    "password": "ElzE",
    "fullName": "LAVEGA, LOUIS KHEN",
    "program": "BSIT"
  },
  {
    "studentId": "11076",
    "password": "HOW0",
    "fullName": "LIBERATO, ERL JOSHUA",
    "program": "BSIT"
  },
  {
    "studentId": "9432",
    "password": "mIT8I2",
    "fullName": "LIBRANDO, RODEN MARK",
    "program": "BSIT"
  },
  {
    "studentId": "11439",
    "password": "eeNtFk",
    "fullName": "LIM, JOHN REVEN",
    "program": "BSIT"
  },
  {
    "studentId": "11312",
    "password": "yR02xH",
    "fullName": "LIMBUAN, MYKA",
    "program": "BSIT"
  },
  {
    "studentId": "9500",
    "password": "5i9l",
    "fullName": "LORESTO, LOYD JOEPHEL",
    "program": "BSIT"
  },
  {
    "studentId": "11499",
    "password": "3C3wp",
    "fullName": "LUMBO, JOVELLE",
    "program": "BSIT"
  },
  {
    "studentId": "7429",
    "password": "6csnof",
    "fullName": "LUMIO, JAN JETHRO",
    "program": "BSIT"
  },
  {
    "studentId": "9416",
    "password": "Z8KN",
    "fullName": "MABULAY, MARK DENVER",
    "program": "BSIT"
  },
  {
    "studentId": "11401",
    "password": "sHCisM",
    "fullName": "MABUNAY, GERARD LEE",
    "program": "BSIT"
  },
  {
    "studentId": "8417",
    "password": "tABL",
    "fullName": "MACAHILIG, JHUNDEL",
    "program": "BSIT"
  },
  {
    "studentId": "10115",
    "password": "zeTC9",
    "fullName": "MACAHILIG, CARL ANDREI",
    "program": "BSIT"
  },
  {
    "studentId": "11383",
    "password": "mj6Pk",
    "fullName": "MACINAS, ROMARK",
    "program": "BSIT"
  },
  {
    "studentId": "9249",
    "password": "sgqJ",
    "fullName": "MAGBANUA, ANA ROSE",
    "program": "BSIT"
  },
  {
    "studentId": "10185",
    "password": "FPA7",
    "fullName": "MAGNO, MARY ROSE",
    "program": "BSIT"
  },
  {
    "studentId": "9164",
    "password": "hcvAw",
    "fullName": "MANTAC, KEMBERLY",
    "program": "BSIT"
  },
  {
    "studentId": "9480",
    "password": "n5y2",
    "fullName": "MAPISA, MILCAH",
    "program": "BSIT"
  },
  {
    "studentId": "10513",
    "password": "1ad6",
    "fullName": "MARCELINO, REYLANCE",
    "program": "BSIT"
  },
  {
    "studentId": "11068",
    "password": "aK4a",
    "fullName": "MARCELLA, JHOVELYN",
    "program": "BSIT"
  },
  {
    "studentId": "10713",
    "password": "APNpf",
    "fullName": "MARIANO, SHEM",
    "program": "BSIT"
  },
  {
    "studentId": "10008",
    "password": "1mjcmK",
    "fullName": "MARTE, JOHN PATRICK",
    "program": "BSIT"
  },
  {
    "studentId": "10705",
    "password": "F9Q2s",
    "fullName": "MASULA, DANILYN",
    "program": "BSIT"
  },
  {
    "studentId": "9863",
    "password": "eSfmip",
    "fullName": "MEÑEZ, GENER",
    "program": "BSIT"
  },
  {
    "studentId": "8959",
    "password": "oh99hA",
    "fullName": "MIJARES, KAREN JOY",
    "program": "BSIT"
  },
  {
    "studentId": "11528",
    "password": "fpTluk",
    "fullName": "MILALLOS, ZEDRICK",
    "program": "BSIT"
  },
  {
    "studentId": "9988",
    "password": "kirI",
    "fullName": "MIRANDA, ROD JANN",
    "program": "BSIT"
  },
  {
    "studentId": "11798",
    "password": "ClYJ",
    "fullName": "MOLO, SARAH",
    "program": "BSIT"
  },
  {
    "studentId": "10789",
    "password": "6UO0n",
    "fullName": "MONGAYA, JM HUMPREY",
    "program": "BSIT"
  },
  {
    "studentId": "9203",
    "password": "gbYDlq",
    "fullName": "MONTOYA, JONA",
    "program": "BSIT"
  },
  {
    "studentId": "11865",
    "password": "DitUx",
    "fullName": "MORADO, AXEL",
    "program": "BSIT"
  },
  {
    "studentId": "8914",
    "password": "TrNMA",
    "fullName": "MORATA, DEOMIL",
    "program": "BSIT"
  },
  {
    "studentId": "11443",
    "password": "LXQdO",
    "fullName": "NACION, JOHN AMMURON",
    "program": "BSIT"
  },
  {
    "studentId": "11105",
    "password": "It53db",
    "fullName": "NADURA, GLEN BERTH",
    "program": "BSIT"
  },
  {
    "studentId": "11240",
    "password": "kSxq",
    "fullName": "NADURA, ANNAILI",
    "program": "BSIT"
  },
  {
    "studentId": "9651",
    "password": "Y4LU",
    "fullName": "NALLAS, JYX YVAN RENAE",
    "program": "BSIT"
  },
  {
    "studentId": "11462",
    "password": "YYvk",
    "fullName": "NAM-AY, FRANCIS",
    "program": "BSIT"
  },
  {
    "studentId": "10787",
    "password": "Xv2Qa",
    "fullName": "NANIT, NIÑO GUIAN",
    "program": "BSIT"
  },
  {
    "studentId": "10967",
    "password": "gvlW",
    "fullName": "NOBLEZA, CHERRYLANE",
    "program": "BSIT"
  },
  {
    "studentId": "11825",
    "password": "eYHfA",
    "fullName": "OBERIO, CHRISTIAN",
    "program": "BSIT"
  },
  {
    "studentId": "11098",
    "password": "E4c6",
    "fullName": "OCZON, YSCEL",
    "program": "BSIT"
  },
  {
    "studentId": "11604",
    "password": "blkc",
    "fullName": "ORTEGA, ROVIELYN",
    "program": "BSIT"
  },
  {
    "studentId": "11103",
    "password": "Ss1KiQ",
    "fullName": "ORTIZ, NIKKI",
    "program": "BSIT"
  },
  {
    "studentId": "11867",
    "password": "2Tnn47",
    "fullName": "PADERES, MIA JASMIN",
    "program": "BSIT"
  },
  {
    "studentId": "10744",
    "password": "PoO1f",
    "fullName": "PADUGA, JEG",
    "program": "BSIT"
  },
  {
    "studentId": "9934",
    "password": "NkAgjT",
    "fullName": "PALMIANO, KC",
    "program": "BSIT"
  },
  {
    "studentId": "10976",
    "password": "8LkD",
    "fullName": "PAMATIAN, REYJIM",
    "program": "BSIT"
  },
  {
    "studentId": "11149",
    "password": "I0MRvO",
    "fullName": "PAYBA, LENNIER JAMES",
    "program": "BSIT"
  },
  {
    "studentId": "9613",
    "password": "Rl4z",
    "fullName": "PELAYO, GABRIEL ROBERT",
    "program": "BSIT"
  },
  {
    "studentId": "9067",
    "password": "GUOqo1",
    "fullName": "PEÑAROYO, ABEGAIL",
    "program": "BSIT"
  },
  {
    "studentId": "11197",
    "password": "HgPoK",
    "fullName": "PENDON, LEO JOHN JR.",
    "program": "BSIT"
  },
  {
    "studentId": "10131",
    "password": "8GF1",
    "fullName": "PERALTA, SOPHIA YSABEL",
    "program": "BSIT"
  },
  {
    "studentId": "11586",
    "password": "v3RY",
    "fullName": "PERALTA, DALE",
    "program": "BSIT"
  },
  {
    "studentId": "11047",
    "password": "cuTdK",
    "fullName": "PERLOTA, JUSTYN",
    "program": "BSIT"
  },
  {
    "studentId": "11409",
    "password": "nT9ep",
    "fullName": "PINES, REYMAR",
    "program": "BSIT"
  },
  {
    "studentId": "9491",
    "password": "Naoa11",
    "fullName": "PINTOR, ALFRED DANE JOSHUA",
    "program": "BSIT"
  },
  {
    "studentId": "9972",
    "password": "1DAjpP",
    "fullName": "PITOY, THEMOTHY JOSEPH",
    "program": "BSIT"
  },
  {
    "studentId": "11558",
    "password": "QWmcBt",
    "fullName": "PLANA, MICHAEL DAVE",
    "program": "BSIT"
  },
  {
    "studentId": "8806",
    "password": "HwPwdQ",
    "fullName": "POSADAS, PHILE JOSEPH",
    "program": "BSIT"
  },
  {
    "studentId": "10339",
    "password": "rL1iC",
    "fullName": "PRIETOS, MARK JOSEPH",
    "program": "BSIT"
  },
  {
    "studentId": "11201",
    "password": "dA1Q",
    "fullName": "RAMBUNAY, APRIL JOY",
    "program": "BSIT"
  },
  {
    "studentId": "9186",
    "password": "6owQhG",
    "fullName": "RAMOS, RESIE",
    "program": "BSIT"
  },
  {
    "studentId": "11175",
    "password": "a3yQ",
    "fullName": "RAPISTA, MICHAEL ANGELO",
    "program": "BSIT"
  },
  {
    "studentId": "11607",
    "password": "wtpeL",
    "fullName": "RATA, DARWIN",
    "program": "BSIT"
  },
  {
    "studentId": "11861",
    "password": "44qbXg",
    "fullName": "RAYMUNDO, ERICKA FAYE",
    "program": "BSIT"
  },
  {
    "studentId": "11033",
    "password": "pHQC9G",
    "fullName": "RAZ, RENZ",
    "program": "BSIT"
  },
  {
    "studentId": "7561",
    "password": "GqFm",
    "fullName": "RAZON, VINCENT JOHN",
    "program": "BSIT"
  },
  {
    "studentId": "10717",
    "password": "U7bGe",
    "fullName": "REBUTAR, JOHN REY",
    "program": "BSIT"
  },
  {
    "studentId": "9373",
    "password": "2jU2",
    "fullName": "REGANIT, JOHN MIKHAIL",
    "program": "BSIT"
  },
  {
    "studentId": "11808",
    "password": "Ry1tr",
    "fullName": "REGINO, MARIELLA",
    "program": "BSIT"
  },
  {
    "studentId": "10083",
    "password": "Xht9a",
    "fullName": "RELLIN, ROMEO JUSTINE",
    "program": "BSIT"
  },
  {
    "studentId": "8637",
    "password": "OYqP",
    "fullName": "RELOJ, JOHN MARK",
    "program": "BSIT"
  },
  {
    "studentId": "11807",
    "password": "wthL",
    "fullName": "REMBULAT, ALLIAH MAE",
    "program": "BSIT"
  },
  {
    "studentId": "9567",
    "password": "4BTOh",
    "fullName": "REMETIO, JOHNWEN",
    "program": "BSIT"
  },
  {
    "studentId": "8225",
    "password": "eneC",
    "fullName": "REPE, AIRA MARIE",
    "program": "BSIT"
  },
  {
    "studentId": "10088",
    "password": "IzOxMk",
    "fullName": "REQUIRO, ALLONAH PEARL",
    "program": "BSIT"
  },
  {
    "studentId": "11736",
    "password": "j2poi",
    "fullName": "RETIRO, REYMON",
    "program": "BSIT"
  },
  {
    "studentId": "10538",
    "password": "ajro",
    "fullName": "REYES, JANZINE",
    "program": "BSIT"
  },
  {
    "studentId": "11414",
    "password": "ahsdf",
    "fullName": "RIBO, JESELLE",
    "program": "BSIT"
  },
  {
    "studentId": "11134",
    "password": "9ylHN",
    "fullName": "RICO, ELBEN JAY",
    "program": "BSIT"
  },
  {
    "studentId": "10935",
    "password": "k22VJ",
    "fullName": "RIVERA, CHIEROL",
    "program": "BSIT"
  },
  {
    "studentId": "11831",
    "password": "uAfmgz",
    "fullName": "ROWAN, BREX KEN",
    "program": "BSIT"
  },
  {
    "studentId": "11099",
    "password": "clH6f",
    "fullName": "SABLAN, HANCE MIGUEL",
    "program": "BSIT"
  },
  {
    "studentId": "8667",
    "password": "GadiZO",
    "fullName": "SAGUANO, EDRIAN",
    "program": "BSIT"
  },
  {
    "studentId": "10433",
    "password": "9kgB2",
    "fullName": "SAILOG, JOYLYN",
    "program": "BSIT"
  },
  {
    "studentId": "10502",
    "password": "FUikp",
    "fullName": "SALAZAR, IRISH",
    "program": "BSIT"
  },
  {
    "studentId": "9183",
    "password": "dBsTAO",
    "fullName": "SALIDO, CARL EMM",
    "program": "BSIT"
  },
  {
    "studentId": "11600",
    "password": "qd21fy",
    "fullName": "SALLADOR, ANDREA",
    "program": "BSIT"
  },
  {
    "studentId": "11601",
    "password": "WIwJ",
    "fullName": "SALUSA, PAUL VINCENT",
    "program": "BSIT"
  },
  {
    "studentId": "9211",
    "password": "NX5p",
    "fullName": "SALVILLA, RAIZA GRACE",
    "program": "BSIT"
  },
  {
    "studentId": "10648",
    "password": "Fj4lF",
    "fullName": "SAMSONA, LYCA MAE",
    "program": "BSIT"
  },
  {
    "studentId": "12027",
    "password": "xUNZ",
    "fullName": "SANCHEZ, VIRGILIO",
    "program": "BSIT"
  },
  {
    "studentId": "11796",
    "password": "6NiE",
    "fullName": "SANGUILLOSA, KEITH PATRICK",
    "program": "BSIT"
  },
  {
    "studentId": "10936",
    "password": "Ok1T",
    "fullName": "SAY, JEROME",
    "program": "BSIT"
  },
  {
    "studentId": "11286",
    "password": "C9dy",
    "fullName": "SELORIO, LINDSEY JOY",
    "program": "BSIT"
  },
  {
    "studentId": "10788",
    "password": "ZBG9B",
    "fullName": "SEÑORA, MARK JAYRALD",
    "program": "BSIT"
  },
  {
    "studentId": "10662",
    "password": "8Mxb4",
    "fullName": "SERRANO, PSYMON ANGELO",
    "program": "BSIT"
  },
  {
    "studentId": "11630",
    "password": "jj3kl5",
    "fullName": "SESALDO, JHON FRITZ",
    "program": "BSIT"
  },
  {
    "studentId": "10903",
    "password": "RC8HXc",
    "fullName": "SIMERA, RAMONA GRACE",
    "program": "BSIT"
  },
  {
    "studentId": "11671",
    "password": "gc7Y",
    "fullName": "SISON, SHIEL MICOLE",
    "program": "BSIT"
  },
  {
    "studentId": "9391",
    "password": "n49p",
    "fullName": "SONIO, JEOBERT",
    "program": "BSIT"
  },
  {
    "studentId": "11069",
    "password": "h7y6",
    "fullName": "SORROSA, RHEA JEAN",
    "program": "BSIT"
  },
  {
    "studentId": "10207",
    "password": "BIYH",
    "fullName": "SUALOG, JENNY ROSE",
    "program": "BSIT"
  },
  {
    "studentId": "11903",
    "password": "8GYJ",
    "fullName": "SUALOG, KURT",
    "program": "BSIT"
  },
  {
    "studentId": "12049",
    "password": "UweEn",
    "fullName": "SUALOG, JAIRUS",
    "program": "BSIT"
  },
  {
    "studentId": "10598",
    "password": "Mfgo",
    "fullName": "SUAREZ, JEUS CALEB",
    "program": "BSIT"
  },
  {
    "studentId": "8454",
    "password": "Qczt",
    "fullName": "SUELTO, MARK",
    "program": "BSIT"
  },
  {
    "studentId": "11288",
    "password": "q8AE",
    "fullName": "SUSMA, MHELJADE",
    "program": "BSIT"
  },
  {
    "studentId": "8915",
    "password": "4N0Wpw",
    "fullName": "TALA-OC, JHON MACKY",
    "program": "BSIT"
  },
  {
    "studentId": "9366",
    "password": "GI048",
    "fullName": "TAMPOS, JOHN VINCE",
    "program": "BSIT"
  },
  {
    "studentId": "10227",
    "password": "StKg",
    "fullName": "TAN, DARENCE",
    "program": "BSIT"
  },
  {
    "studentId": "11457",
    "password": "ZISh",
    "fullName": "TANA, KARLA DOMINIC",
    "program": "BSIT"
  },
  {
    "studentId": "10112",
    "password": "sSwKv",
    "fullName": "TANIEZA, MA. PERDILYN",
    "program": "BSIT"
  },
  {
    "studentId": "11234",
    "password": "Ty3Uc",
    "fullName": "TAPLAC, CLINT BERND ANJELO",
    "program": "BSIT"
  },
  {
    "studentId": "9486",
    "password": "3eOoDF",
    "fullName": "TAUNAN, CHYNA",
    "program": "BSIT"
  },
  {
    "studentId": "12039",
    "password": "LFcjAU",
    "fullName": "TEFORA, DIVINA GRACIA",
    "program": "BSIT"
  },
  {
    "studentId": "11001",
    "password": "AyJshh",
    "fullName": "TEODOSIO, JOHN EVAN",
    "program": "BSIT"
  },
  {
    "studentId": "11800",
    "password": "KCLf0d",
    "fullName": "TEODOSIO, RAHANNI GEUEL",
    "program": "BSIT"
  },
  {
    "studentId": "10280",
    "password": "J50C",
    "fullName": "TIRAZONA, CHRISTIAN DIOR",
    "program": "BSIT"
  },
  {
    "studentId": "10994",
    "password": "cYsy",
    "fullName": "TOLENTINO, JAICA AIRA",
    "program": "BSIT"
  },
  {
    "studentId": "9387",
    "password": "6Yux",
    "fullName": "TUBIERA, ANJANETH",
    "program": "BSIT"
  },
  {
    "studentId": "9548",
    "password": "63W4",
    "fullName": "TUGNAO, CHARL",
    "program": "BSIT"
  },
  {
    "studentId": "10695",
    "password": "IEtP",
    "fullName": "TUMBAGAHAN, HARLIE",
    "program": "BSIT"
  },
  {
    "studentId": "10365",
    "password": "5baiHM",
    "fullName": "TURIEGO, BEN PAUL",
    "program": "BSIT"
  },
  {
    "studentId": "11911",
    "password": "LuQwJ2",
    "fullName": "TUTAY, VEL MARK",
    "program": "BSIT"
  },
  {
    "studentId": "10605",
    "password": "BvSfJ0",
    "fullName": "VALENTIN, CYRON",
    "program": "BSIT"
  },
  {
    "studentId": "9313",
    "password": "YVPJ0k",
    "fullName": "VENTURA, MARK LARRY",
    "program": "BSIT"
  },
  {
    "studentId": "11676",
    "password": "HDiyny",
    "fullName": "VENTURA, KYVEN CLYRE",
    "program": "BSIT"
  },
  {
    "studentId": "11226",
    "password": "VmW3w",
    "fullName": "VILLAR, SAIMON GRAY",
    "program": "BSIT"
  },
  {
    "studentId": "9384",
    "password": "o0758v",
    "fullName": "VILLARUEL, JOMARI",
    "program": "BSIT"
  },
  {
    "studentId": "9888",
    "password": "jU9g",
    "fullName": "ZAULDA, JORDAN",
    "program": "BSIT"
  },
  {
    "studentId": "10665",
    "password": "0KXswL",
    "fullName": "ZAUSA, RHEAN NEARBELLE",
    "program": "BSIT"
  },
  {
    "studentId": "11680",
    "password": "YSgcB8",
    "fullName": "ZONIO, FERN CHARLES",
    "program": "BSIT"
  }
];

async function seedStudentsFromExcel() {
  console.log(`--- Seeding ${STUDENTS.length} legacy student accounts from Excel ---`);

  let okCount = 0;
  let failCount = 0;

  for (const s of STUDENTS) {
    try {
      const now = new Date().toISOString();
      const internalId = `student-${s.studentId}`;
      const passwordHash = await bcrypt.hash(s.password, 10);

      // 1. Permanent student record — verified, no photos required (legacy official data)
      const { error: studentErr } = await supabase.from('students').upsert([{
        id: internalId,
        student_id: s.studentId,
        full_name: s.fullName,
        program: s.program,
        year_level: 1,
        status: 'approved',
        verified: true,
        created_at: now
      }], { onConflict: 'student_id' });

      if (studentErr) {
        console.warn(`  [students] ${s.studentId} (${s.fullName}):`, studentErr.message);
      }

      // 2. Login account — bulk_imported = true so the weekly reset job skips it
      const { error: accountErr } = await supabase.from('accounts').upsert([{
        id: `acc-${s.studentId}`,
        student_id: s.studentId,
        username: s.studentId,
        password_hash: passwordHash,
        role: 'student',
        status: 'approved',
        bulk_imported: true,
        created_at: now
      }], { onConflict: 'username' });

      if (accountErr) {
        console.warn(`  [accounts] ${s.studentId} (${s.fullName}):`, accountErr.message);
        failCount++;
        continue;
      }

      // 3. Sync to profiles for backwards compatibility with admin/staff lookups
      await supabase.from('profiles').upsert([{
        id: internalId,
        email: `${s.studentId.toLowerCase()}@student.gct.edu.ph`,
        role: 'student',
        full_name: s.fullName,
        approval_status: 'approved',
        created_at: now
      }], { onConflict: 'email' });

      okCount++;
      console.log(`  ok   ${s.studentId}  (${s.fullName})`);
    } catch (err) {
      failCount++;
      console.warn(`  FAILED ${s.studentId}:`, err.message);
    }
  }

  console.log(`--- Done: ${okCount} seeded, ${failCount} failed ---`);
}

if (require.main === module) {
  seedStudentsFromExcel()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedStudentsFromExcel, STUDENTS };
