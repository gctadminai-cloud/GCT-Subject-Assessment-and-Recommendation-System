const { GoogleGenAI } = require('@google/genai');
const { supabase } = require('../config/supabase');
const { normalizeSubjCode, evaluateStudent } = require('../services/assessmentEngine');

// Quota error cooldown tracker to prevent repeated 6s timeouts when free tier is exhausted
let geminiQuotaBlockedUntil = 0;

/**
 * Strips unicode emojis and decorative symbols from text to enforce clean, professional formatting
 */
function stripEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Replace typical emoji characters
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    // Replace specific decorative symbols commonly used as emojis
    .replace(/[🔒👉🎓⛔👋📥✅❌📋⏳👥🔍📊⚙️✨💡]/g, '')
    // Clean up multiple spaces
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Official Institutional FAQs for Garcia College of Technology
 */
const GCT_OFFICIAL_FAQS = [
  {
    id: 1,
    questionEn: "What are the admission requirements for new college students?",
    questionTl: "Ano ang admission requirements para sa bagong estudyante sa kolehiyo?",
    patterns: [
      /requirements?\s+for\s+new\s+(?:college\s+)?students?/i,
      /admission\s+requirements?/i,
      /requirements?\s+ng\s+(?:mga\s+)?bagong\s+estudyante/i,
      /requirements?\s+sa\s+freshm[ae]n/i,
      /freshm[ae]n\s+requirements?/i,
      /new\s+(?:college\s+)?student\s+requirements?/i
    ],
    answerEn: `**Admission Requirements for New College Students:**\n- Senior High School Report Card (Form 138)\n- Certificate of Good Moral Character\n- One (1) recent 1×1 ID picture\n- Photocopy of PSA Birth Certificate\n\nWould you like information on the enrollment procedure, or the requirements for old students or transferees?`,
    answerTl: `**Mga Kinakailangan sa Admission para sa Bagong Estudyante (New College Students):**\n- Senior High School Report Card (Form 138)\n- Certificate of Good Moral Character\n- Isa (1) na pirasong 1×1 ID picture\n- Photocopy ng PSA Birth Certificate\n\nNais mo ba ng impormasyon ukol sa proseso ng enrollment, o ang mga kinakailangan para sa mga dating estudyante o transferees?`
  },
  {
    id: 2,
    questionEn: "What are the requirements for old students?",
    questionTl: "Ano ang requirements para sa dating estudyante (old students)?",
    patterns: [
      /requirements?\s+for\s+old\s+students?/i,
      /old\s+students?\s+requirements?/i,
      /requirements?\s+ng\s+(?:mga\s+)?dating\s+estudyante/i,
      /continuing\s+students?\s+requirements?/i
    ],
    answerEn: `**Requirements for Old Students:**\n- Clearance from the previous semester\n- School ID\n- Grades from the previous semester\n\nWould you like to know how to process your clearance, or check your eligible subjects for the upcoming semester?`,
    answerTl: `**Mga Kinakailangan para sa Dating Estudyante (Old Students):**\n- Clearance mula sa nakaraang semestre\n- School ID\n- Mga Marka (Grades) mula sa nakaraang semestre\n\nNais mo bang malaman kung paano mag-asikaso ng clearance, o tingnan ang mga kwalipikadong asignatura para sa susunod na semestre?`
  },
  {
    id: 3,
    questionEn: "What are the requirements for transferees?",
    questionTl: "Ano ang requirements para sa transferees?",
    patterns: [
      /requirements?\s+for\s+transferees?/i,
      /transferees?\s+requirements?/i,
      /requirements?\s+ng\s+(?:mga\s+)?transferee/i,
      /requirements?\s+kapag\s+lumipat/i
    ],
    answerEn: `**Requirements for Transferees:**\n- Transfer Credentials / Honorable Dismissal\n- Certified copy of college subjects taken\n- Certificate of Good Moral Character\n- One (1) recent 1×1 ID picture\n- Photocopy of PSA Birth Certificate\n\nWould you like to know how transferees can apply for subject crediting and accreditation?`,
    answerTl: `**Mga Kinakailangan para sa Transferees:**\n- Transfer Credentials / Honorable Dismissal\n- Certified copy ng mga nakuhang college subjects\n- Certificate of Good Moral Character\n- Isa (1) na pirasong 1×1 ID picture\n- Photocopy ng PSA Birth Certificate\n\nNais mo bang malaman kung paano mag-apply ang mga transferee para sa accreditation at pag-credit ng mga nakaraang asignatura?`
  },
  {
    id: 4,
    questionEn: "Can transferees have their previous subjects credited?",
    questionTl: "Maaari bang ma-credit ang nakaraang subjects ng transferees?",
    patterns: [
      /(?:previous\s+)?subjects?\s+(?:credited|accredited)/i,
      /credited\s+(?:ang\s+)?(?:dating\s+)?subjects?/i,
      /can\s+transferees?\s+have\s+(?:their\s+)?previous\s+subjects?\s+credited/i,
      /ma-?credit\s+(?:ba\s+)?(?:ang\s+)?(?:dating\s+)?subjects?/i,
      /accreditation\s+of\s+subjects?/i
    ],
    answerEn: `**Accreditation of Subjects for Transferees:**\nYes. Transferees can apply for accreditation of subjects through the Office of the Registrar, subject to approval by the College Dean.\n\nWould you like the contact details of the Office of the Registrar to start your subject accreditation inquiry?`,
    answerTl: `**Pag-credit ng mga Nakaraang Subjects para sa Transferees:**\nOpo. Maaaring mag-apply ang mga transferee para sa accreditation ng kanilang mga subjects sa pamamagitan ng Office of the Registrar, batay sa pagsusuri at pag-apruba ng College Dean.\n\nNais mo ba ang mga detalye ng pakikipag-ugnayan sa Office of the Registrar upang magtanong ukol sa subject evaluation?`
  },
  {
    id: 5,
    questionEn: "How can I contact the GCT College Registrar?",
    questionTl: "Paano makikipag-ugnayan sa GCT College Registrar?",
    patterns: [
      /contact\s+(?:the\s+)?(?:gct\s+)?(?:college\s+)?registrar/i,
      /registrar\s+(?:contact|phone|telephone|email|number)/i,
      /paano\s+makontak\s+ang\s+registrar/i,
      /tawag\s+sa\s+registrar/i,
      /gctregistrar\.collegedept2021/i
    ],
    answerEn: `**GCT College Registrar Contact Information:**\nThe College Registrar can be contacted at:\n- **Phone:** (036) 262-8621\n- **Email:** gctregistrar.collegedept2021@gmail.com\n- **Office Hours:** Monday to Friday, 8:00 AM – 5:00 PM\n\nWould you like assistance with admissions, enrollment schedules, or campus location details?`,
    answerTl: `**Impormasyon sa Pakikipag-ugnayan sa GCT College Registrar:**\nMaaaring makontak ang College Registrar sa:\n- **Telepono:** (036) 262-8621\n- **Email:** gctregistrar.collegedept2021@gmail.com\n- **Oras ng Tanggapan:** Lunes hanggang Biyernes, 8:00 AM – 5:00 PM\n\nKailangan mo ba ng tulong ukol sa admissions, iskedyul ng enrollment, o direksyon sa lokasyon ng campus?`
  },
  {
    id: 6,
    questionEn: "What is GCT's mission?",
    questionTl: "Ano ang misyon ng GCT?",
    patterns: [
      /gct(?:'s)?\s+mission/i,
      /mission\s+of\s+gct/i,
      /misyon\s+ng\s+gct/i,
      /what\s+is\s+gct\s+mission/i
    ],
    answerEn: `**GCT's Mission:**\nGCT aims to provide quality education and develop the full potential and capabilities of individuals.\n\nWould you like to learn more about our academic degree programs or admission guidelines?`,
    answerTl: `**Misyon ng GCT:**\nLayunin ng GCT na magbigay ng de-kalidad na edukasyon at paunlarin ang buong potensyal at kakayahan ng bawat indibidwal.\n\nNais mo bang magkaroon ng karagdagang impormasyon ukol sa mga degree programs o patakaran sa admission?`
  },
  {
    id: 7,
    questionEn: "When was Garcia College of Technology established?",
    questionTl: "Kailan naitatag ang Garcia College of Technology?",
    patterns: [
      /when\s+was\s+(?:garcia|gct)\s+(?:established|founded)/i,
      /kailan\s+(?:naitatag|tinatag)\s+ang\s+(?:gct|garcia)/i,
      /year\s+(?:established|founded)/i,
      /established\s+in\s+1968/i
    ],
    answerEn: `**Establishment of Garcia College of Technology:**\nGarcia College of Technology (GCT) was established in **1968**.\n\nWould you like to know more about GCT's degree programs, mission, or campus location?`,
    answerTl: `**Pagtatatag ng Garcia College of Technology:**\nAng Garcia College of Technology (GCT) ay naitatag noong taong **1968**.\n\nNais mo bang malaman ang higit pa tungkol sa mga programa, misyon, o lokasyon ng campus ng GCT?`
  },
  {
    id: 8,
    questionEn: "Where is Garcia College of Technology located?",
    questionTl: "Saan matatagpuan ang Garcia College of Technology?",
    patterns: [
      /where\s+is\s+(?:garcia|gct)\s+located/i,
      /location\s+of\s+(?:gct|garcia)/i,
      /saan\s+matatagpuan\s+ang\s+(?:gct|garcia)/i,
      /saan\s+ang\s+(?:gct|garcia)/i,
      /campus\s+(?:address|location)/i
    ],
    answerEn: `**Garcia College of Technology Location:**\nGCT is located on **Osmeña Avenue, Estancia, Kalibo, Aklan**.\n\nWould you like to know the Registrar's Office hours or the admission requirements for enrolling at GCT?`,
    answerTl: `**Lokasyon ng Garcia College of Technology:**\nAng GCT ay matatagpuan sa **Osmeña Avenue, Estancia, Kalibo, Aklan**.\n\nNais mo bang malaman ang mga oras ng tanggapan ng Registrar o ang mga kinakailangan para sa enrollment sa GCT?`
  }
];

const GCT_FAQS_CONTEXT_BLOCK = `
OFFICIAL GCT INSTITUTIONAL FAQs & FACTS:
1. Admission Requirements for New College Students:
   - Senior High School Report Card (Form 138)
   - Certificate of Good Moral Character
   - One (1) recent 1x1 ID picture
   - Photocopy of PSA Birth Certificate
2. Requirements for Old Students:
   - Clearance from the previous semester
   - School ID
   - Grades from the previous semester
3. Requirements for Transferees:
   - Transfer Credentials / Honorable Dismissal
   - Certified copy of college subjects taken
   - Certificate of Good Moral Character
   - One (1) recent 1x1 ID picture
   - Photocopy of PSA Birth Certificate
4. Transferee Subject Crediting / Accreditation:
   - Yes. Transferees can apply for accreditation of subjects through the Office of the Registrar, subject to approval by the College Dean.
5. GCT College Registrar Contact:
   - Phone: (036) 262-8621
   - Email: gctregistrar.collegedept2021@gmail.com
   - Office Hours: Monday to Friday, 8:00 AM - 5:00 PM
6. GCT Mission:
   - GCT aims to provide quality education and develop the full potential and capabilities of individuals.
7. Year Established:
   - Garcia College of Technology was established in 1968.
8. Campus Location:
   - Osmeña Avenue, Estancia, Kalibo, Aklan.
`;

function matchGctFaq(query, isTagalog = false) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim();

  // If user asked general "faq", "faqs", or "frequently asked questions"
  if (/^(?:faqs?|frequently\s+asked\s+questions?|listahan\s+ng\s+faqs?)$/i.test(q.replace(/[^\w\s]/g, '').trim())) {
    return isTagalog
      ? `### Garcia College of Technology — Mga Madalas Itanong (FAQs)\n\n1. **Admission Requirements (New College Students):**\n   - Senior High School Report Card (Form 138)\n   - Certificate of Good Moral Character\n   - Isa (1) na pirasong 1×1 ID picture\n   - Photocopy ng PSA Birth Certificate\n\n2. **Requirements para sa Dating Estudyante (Old Students):**\n   - Clearance mula sa nakaraang semestre\n   - School ID\n   - Grades mula sa nakaraang semestre\n\n3. **Requirements para sa Transferees:**\n   - Transfer Credentials / Honorable Dismissal\n   - Certified copy ng subjects taken\n   - Certificate of Good Moral Character\n   - Isa (1) na pirasong 1×1 ID picture\n   - Photocopy ng PSA Birth Certificate\n\n4. **Pag-credit ng Subjects para sa Transferees:**\n   - Opo. Maaaring mag-apply para sa accreditation sa Office of the Registrar, subject to approval ng College Dean.\n\n5. **Pakikipag-ugnayan sa Registrar:**\n   - Telepono: (036) 262-8621 | Email: gctregistrar.collegedept2021@gmail.com\n\n6. **Misyon ng GCT:**\n   - Magbigay ng de-kalidad na edukasyon at paunlarin ang buong potensyal at kakayahan ng bawat indibidwal.\n\n7. **Kailan Naitatag:**\n   - Naitatag noong taong 1968.\n\n8. **Lokasyon:**\n   - Osmeña Avenue, Estancia, Kalibo, Aklan.\n\nAlin sa mga paksang ito ang nais mong suriin nang mas detalyado, o nais mo ba ng gabay sa pagpaparehistro ng student account?`
      : `### Garcia College of Technology — Frequently Asked Questions (FAQs)\n\n1. **Admission Requirements for New College Students:**\n   - Senior High School Report Card (Form 138)\n   - Certificate of Good Moral Character\n   - One (1) recent 1×1 ID picture\n   - Photocopy of PSA Birth Certificate\n\n2. **Requirements for Old Students:**\n   - Clearance from the previous semester\n   - School ID\n   - Grades from the previous semester\n\n3. **Requirements for Transferees:**\n   - Transfer Credentials / Honorable Dismissal\n   - Certified copy of college subjects taken\n   - Certificate of Good Moral Character\n   - One (1) recent 1×1 ID picture\n   - Photocopy of PSA Birth Certificate\n\n4. **Can transferees have previous subjects credited?**\n   - Yes. Transferees can apply for accreditation of subjects through the Office of the Registrar, subject to approval by the College Dean.\n\n5. **How to contact the GCT College Registrar:**\n   - Phone: (036) 262-8621 | Email: gctregistrar.collegedept2021@gmail.com\n\n6. **GCT's Mission:**\n   - GCT aims to provide quality education and develop the full potential and capabilities of individuals.\n\n7. **When Established:**\n   - GCT was established in 1968.\n\n8. **Campus Location:**\n   - GCT is located on Osmeña Avenue, Estancia, Kalibo, Aklan.\n\nWhich of these topics would you like to explore further, or would you like guidance on creating a student account?`;
  }

  for (const item of GCT_OFFICIAL_FAQS) {
    for (const pattern of item.patterns) {
      if (pattern.test(q)) {
        return isTagalog ? item.answerTl : item.answerEn;
      }
    }
  }

  return null;
}

/**
 * Checks if a query is completely out of scope of the GCT Subject Assessment & Recommendation System
 */
function isOutOfScopeQuery(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return false;

  // Never flag system, academic, or institutional terms as out of scope
  const academicTerms = /\b(gct|garcia|student|grades?|subject|course|curriculum|bsit|bscs|prereq|prerequisite|eval|evaluation|standing|passed|failed|fail|retake|drop|dropped|advising|recommend|recommendation|registrar|enroll|enrol|enrollment|register|registration|account|login|portal|gwa|units|schedule|section|slip|clearance|graduation|academic|thesis|capstone|threshold|officer|staff|admin|system|feature|capabilities|help|ano kaya mo|tulong|opinion|opinyon|tingin|advice|advise|suggest|suhestiyon|requirements?|admission|admissions|transferees?|accreditation|accredited|credited|credit|contact|phone|telephone|email|mission|misyon|established|founded|tinatag|naitatag|1968|location|located|address|osmena|osmeña|kalibo|aklan|faq|faqs|sf\s*9|birth\s*certificate|good\s*moral|honorable\s*dismissal)\b/i;
  if (academicTerms.test(q)) {
    return false;
  }

  // Greetings and common courtesies are not out of scope
  if (/^(hi|hello|hey|kumusta|kamusta|good\s*(morning|afternoon|evening|day)|salamat|thank\s*you|thanks|paalam|bye|ok|okay|yes|no)$/i.test(q.replace(/[^\w\s]/g, '').trim())) {
    return false;
  }

  // Detect explicit off-topic subjects
  const outOfScopePatterns = [
    /\b(weather|temperature|forecast|rain|raining|ulan|bagyo|sunny|cloudy|humidity)\b/i,
    /\b(nba|basketball|soccer|football|volleyball|tennis|boxing|championship|score of|lakers|warriors|game 7)\b/i,
    /\b(president|election|politics|senator|mayor|congress|political|duterte|marcos|biden|trump)\b/i,
    /\b(recipe|cook|cooking|bake|baking|ingredients|adobo|sinigang|fried chicken|delicious|restaurant)\b/i,
    /\b(movie|cinema|actor|actress|hollywood|netflix|kdrama|kpop|album|song lyrics|sing a song)\b/i,
    /\b(capital of|tallest building|tallest mountain|population of|distance to|speed of light)\b/i,
    /\b(crypto|bitcoin|ethereum|forex|stock market|trading|invest in crypto)\b/i,
    /\b(tell me a joke|make me laugh|love poem|pick up line|horoscope|zodiac)\b/i,
    /\b(hack|crack password|facebook account|ddos|exploit)\b/i
  ];

  for (const pattern of outOfScopePatterns) {
    if (pattern.test(q)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if a user query is in Tagalog, Taglish, or Filipino.
 * Primary/default language of the assistant is English; Tagalog is used when this returns true.
 */
function isTagalogQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const q = text.toLowerCase();
  const tagalogPatterns = [
    /\b(naba|na\s*ba|mag[-\s]?enroll|mag[-\s]?register|applicable\s+na\s+ba)\b/i,
    /\b(ano|bakit|paano|kailan|saan|sino|alin|nasaan)\b/i,
    /\b(kamusta|kumusta|mabuhay|salamat|paalam)\b/i,
    /\b(pwede|puwede|meron|mayroon|wala|walang|hindi|di|diko|di\s*ko|ayaw|gusto|kailangan|need\s*ko)\b/i,
    /\b(natin|ninyo|kayo|siya|sila|ako|ikaw|kami|tayo|ito|iyan|iyon|dito|diyan|doon)\b/i,
    /\b(ba|na|pa|din|rin|lang|naman|po|opo|nga|pala|kasi)\b/i,
    /\b(opinyon|tingin\s*mo|palagay\s*mo|tulungan|tulong|estudyante|magkano|ipasa|ipapasa|bagsak|pasa|aral|subheto|marka)\b/i
  ];
  return tagalogPatterns.some(pattern => pattern.test(q));
}

/**
 * Generate polite out-of-scope response explaining assistant's dedicated boundary
 */
function generateOutOfScopeResponse(query) {
  const isTagalog = isTagalogQuery(query);

  if (isTagalog) {
    return `Paumanhin, ngunit hindi sakop ng aking kakayahan ang paksang iyan. Ako ay isang AI assistant na partikular na binuo para lamang sa Garcia College of Technology (GCT) Subject Assessment and Recommendation System.

Ang aking sakop ay nakatuon lamang sa:
- Student academic records at grades evaluation
- Cumulative GWA calculations at academic standing
- Curriculum matrix at prerequisite tracking (BSIT / BSCS)
- Subject recommendations at advising slips para sa susunod na semestre
- Enrollment at registration assistance sa GCT Portal

Nais mo bang magtanong ukol sa iyong mga marka, subject recommendations, o gabay sa enrollment sa GCT?`;
  }

  return `I apologize, but that topic is outside my scope. I am an AI assistant specifically dedicated to the Garcia College of Technology (GCT) Subject Assessment and Recommendation System.

My capabilities are strictly focused on:
- Student academic records, grades, and completion history
- Cumulative GWA calculations and academic standing
- Curriculum matrix and prerequisite tracking (BSIT & BSCS)
- Automated subject recommendations and advising slips
- Portal registration and enrollment inquiries

Would you like assistance with your student records, upcoming subject recommendations, or enrollment at GCT?`;
}

/**
 * Detects whether a student query is a pure conversational greeting or courtesy
 * without substantive academic lookup or transaction requests.
 */
function isStudentGreetingQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.trim().toLowerCase();
  const cleanQ = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQ) return false;

  // Substantive academic, administrative, or action keywords that indicate a real request
  const hasAcademicSubject = /\b(grade|grades|marka|score|rating|transcript|talaan|gwa|record|records|passed|pasa|failed|bagsak|deficienc|retake|retakes|recommend|recommendation|rekomendasyon|subject|subjects|course|courses|kukunin|curriculum|advising|load|enroll|enrollment|mag[-\s]?enroll|assess|assessment|evaluat|pagsusuri|prereq|prerequisite|standing|download|excel|csv|word|pdf|text|file|document|status|units|schedule|section|tuition|fee|fees|balance|clearance|drop|dropped|shift|shiftee|transferee|opinion|opinyon|advice|payo)\b/i.test(cleanQ);

  if (hasAcademicSubject) return false;

  // Exact or common greeting starters
  const greetingPattern = /^(?:hi|hello|hey|hoy|yo|sup|kumusta|kamusta|musta|mabuhay|good\s*(?:morning|afternoon|evening|day)|magandang\s*(?:araw|umaga|hapon|gabi)|greetings|how\s*are\s*you|ano\s*balita)\b/i;
  if (greetingPattern.test(cleanQ)) {
    const words = cleanQ.split(' ');
    if (words.length <= 6) return true;
  }
  return false;
}

/**
 * Generates a clean, friendly, conversational greeting response for students
 * Strictly zero emojis, no memorandum format, and no unsolicited evaluation tables or GWA dumps.
 */
function buildStudentGreetingResponse(query, userName, isTagalog) {
  const q = (query || '').toLowerCase();

  let greetingSalutation = '';
  if (/\b(?:good\s*morning|magandang\s*umaga)\b/i.test(q)) {
    greetingSalutation = isTagalog ? `Magandang umaga po, **${userName}**!` : `Good morning, **${userName}**!`;
  } else if (/\b(?:good\s*afternoon|magandang\s*hapon)\b/i.test(q)) {
    greetingSalutation = isTagalog ? `Magandang hapon po, **${userName}**!` : `Good afternoon, **${userName}**!`;
  } else if (/\b(?:good\s*evening|magandang\s*gabi)\b/i.test(q)) {
    greetingSalutation = isTagalog ? `Magandang gabi po, **${userName}**!` : `Good evening, **${userName}**!`;
  } else if (/\b(?:kumusta|kamusta)\b/i.test(q)) {
    greetingSalutation = isTagalog ? `Hello po, **${userName}**! Mabuti naman po ako, kumusta ka?` : `Hello, **${userName}**! I am doing well, how are you?`;
  } else {
    greetingSalutation = isTagalog ? `Hello po, **${userName}**!` : `Hello, **${userName}**!`;
  }

  if (isTagalog) {
    return `${greetingSalutation} Ako ang iyong opisyal na **GCT Student AI Assistant**.

Paano kita matutulungan sa iyong pag-aaral ngayon? Maaari kang magtanong tungkol sa:
- Iyong mga **marka** at **cumulative GWA**
- Mga **inirerekomendang asignatura** para sa susunod na semestre
- Pagsusuri sa iyong **prerequisites** at **active deficiencies**
- Pag-download ng iyong opisyal na academic record sa **Excel**, **Word**, o **Text**

Nais mo bang suriin ang iyong mga marka, tingnan ang inirerekomendang subjects para sa susunod na semestre, o kalkulahin ang iyong cumulative GWA?`;
  }

  return `${greetingSalutation} I am your official **GCT Student AI Assistant**.

How can I help you with your academic inquiries today? You can ask me to:
- Review your **grades** and **cumulative GWA**
- Check your **recommended subjects** for the upcoming semester
- Evaluate your **prerequisite standing** and active deficiencies
- Export your official academic record in **Excel**, **Word**, or **Text**

Would you like to review your latest grades, check your recommended subjects for next semester, or check your cumulative GWA?`;
}

/**
 * Check if the user is requesting an academic opinion or advice
 */
function isAskingOpinionQuery(query) {
  return /\b(opinion|opinyon|tingin mo|palagay|advice|advise|recommendation|suhestiyon|suggest|should i|dapat ba|ano sa tingin mo|kayang kaya ba|evaluate|evaluation|assessment|ano maipapayo)\b/i.test(query);
}

/**
 * Generate a thoughtful, structured academic opinion for a student (Bilingual: English default, Tagalog on demand)
 */
function generateStudentOpinion(studentInfo, stats, records, failedSubjects, isTagalog = false) {
  const gwaNum = Number(stats.gwa);
  const hasGwa = !isNaN(gwaNum) && gwaNum > 0;
  const isHighPerformer = hasGwa && gwaNum <= 1.75;
  const isAverage = hasGwa && gwaNum > 1.75 && gwaNum <= 2.50;
  const isStruggling = (hasGwa && gwaNum > 2.50) || stats.failedCount > 0;

  const failedCodes = failedSubjects.map(f => f.code).filter(Boolean);

  if (isTagalog) {
    let standingOpinion = '';
    if (isHighPerformer) {
      standingOpinion = `Ang iyong cumulative GWA na ${stats.gwa} ay nagpapakita ng natatanging husay sa akademya. Nasa posisyon ka para sa honors standing o kumuha ng advanced specialization tracks.`;
    } else if (isAverage) {
      standingOpinion = `Ang iyong cumulative GWA na ${stats.gwa} ay sumasalamin sa maayos at matatag na academic standing. Panatilihin ang pare-parehong sipag sa pag-aaral upang makapagtapos sa takdang panahon.`;
    } else {
      standingOpinion = `Ang iyong academic record ay nangangailangan ng karagdagang tutok at pag-iingat. May ${stats.failedCount} deficiency/retake subject(s) sa iyong talaan, kaya mahalagang maging estratehiko sa pagpili ng subjects ngayong paparating na termino.`;
    }

    let priorityAdvice = '';
    if (failedCodes.length > 0) {
      priorityAdvice = `1. Unahin ang Retake Subjects: I-enroll muna ang ${failedCodes.join(', ')}. Sa GCT curriculum, ang mga bagsak na prerequisites ay humaharang sa higher-year major subjects. Kapag naipasa ito agad, maiiwasan ang pagkaantala sa pagtatapos.\n2. Balanseng Academic Load: Iwasan ang overload; mas mainam na kumuha ng 18 hanggang 21 units upang may sapat na oras mag-aral para sa mabibigat na subjects.`;
    } else {
      priorityAdvice = `1. Pagsunod sa Curriculum Matrix: Sundin ang opisyal na pagkakasunod-sunod ng subjects ayon sa curriculum matrix upang mabuksan ang prerequisites ng mga darating na semestre.\n2. Balanseng Workload: Panatilihin ang balanse sa pagitan ng programming laboratory courses at general education subjects.`;
    }

    return `### Opinyon at Pagsusuri sa Academic Advising

**Pagtatasa sa Academic Standing:**
${standingOpinion}

**Mga Rekomendasyon:**
${priorityAdvice}
3. Konsultasyon sa Registrar: Bago ang pinal na pag-enroll, repasuhin ang iyong advising slip kasama ang Program Chair o Registrar Staff upang masigurong tugma ang schedule ng mga seksyon.`;
  }

  // Default: Professional English
  let standingOpinion = '';
  if (isHighPerformer) {
    standingOpinion = `Your cumulative GWA of ${stats.gwa} demonstrates strong academic performance. You are well-positioned for honors standing or taking elective tracks with advanced specialization.`;
  } else if (isAverage) {
    standingOpinion = `Your cumulative GWA of ${stats.gwa} reflects steady academic standing. Continuing with consistent study habits will keep you on track for regular graduation.`;
  } else {
    standingOpinion = `Your academic record currently requires focused attention. With ${stats.failedCount} deficiency/retake subject(s) recorded, strategic subject selection is essential this upcoming term.`;
  }

  let priorityAdvice = '';
  if (failedCodes.length > 0) {
    priorityAdvice = `1. Priority Retakes First: Prioritize re-enrolling in ${failedCodes.join(', ')}. In GCT curriculum, failed prerequisites block major 2nd, 3rd, and 4th year subjects. Clearing these immediately prevents graduation delays.
2. Balanced Workload: Instead of carrying an overload, consider taking 18 to 21 units so you can focus adequate time on your challenging subjects.`;
  } else {
    priorityAdvice = `1. Prerequisite Progression: Continue following your curriculum matrix in sequence. Ensure major core courses are prioritized to unlock upcoming semester prerequisites.
2. Skill Development: Maintain a balanced semester workload between programming laboratory courses and general education units.`;
  }

  return `### Academic Advising Opinion & Evaluation

**Academic Standing Assessment:**
${standingOpinion}

**Strategic Recommendations:**
${priorityAdvice}
3. Faculty Advising: Before final enrollment, review your recommended advising slip with your program chair or the Registrar to ensure all section schedules align smoothly.`;
}

/**
 * Strips memorandum headers, "TO/FROM/DATE/SUBJECT", and bureaucratic memo formatting
 */
function cleanMemorandumFormatting(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Strip MEMORANDUM titles (case-insensitive)
    .replace(/^#*\s*MEMORANDUM\s*$/gmi, '')
    // Strip TO:, FROM:, DATE:, SUBJECT: headers
    .replace(/^(?:TO|FROM|DATE|SUBJECT):\s*[^\n]*\n?/gmi, '')
    // Convert numbered bureaucratic headings into standard Markdown section headings
    .replace(/^(\d+\.)\s+(STUDENT PROFILE SUMMARY|FORMAL REGISTRAR EVALUATION|SUBJECT RECOMMENDATIONS FOR THE UPCOMING TERM|SYSTEM ACTIONS & FILE GENERATION NOTICE)\b/gmi, '### $2')
    // Strip bracketed pseudo-buttons that LLMs sometimes hallucinate like [Download Assessment File (EXCEL)], [Open Academic Records], [Open Subject Recommendations]
    .replace(/^\s*\[(?:Download[^\n\]]*|Open Academic Records[^\n\]]*|Open Subject Recommendations[^\n\]]*)\]\s*$/gmi, '')
    // Remove triple or more newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Helper to format numeric academic grades with 2 decimal places (e.g. 1.00, 1.25, 1.50, 2.00, 5.00)
 */
function formatGrade2Decimals(val) {
  if (val === null || val === undefined || val === '' || val === 'N/A' || val === 'DRP') return val || 'N/A';
  const num = parseFloat(String(val).trim());
  if (!isNaN(num) && num > 0) {
    return num.toFixed(2);
  }
  return String(val);
}

/**
 * Format a list of student grade records into a clean Markdown Table
 */
function buildGradesTableMarkdown(records) {
  if (!records || records.length === 0) {
    return [
      '| Subject Code | Description | Units | Grade | Status | Academic Term |',
      '| :--- | :--- | :---: | :---: | :---: | :--- |',
      '| — | No academic records encoded yet | 0 | — | — | — |'
    ].join('\n');
  }

  const rows = records.map(r => {
    const code = r.code || r.subject || 'SUBJ';
    const title = String(r.title || r.subject_title || 'Curriculum Course').replace(/\|/g, '-').trim();
    const units = r.units != null ? r.units : 3;
    let gradeStr = 'N/A';
    if (r.is_dropped || r.status === 'dropped') {
      gradeStr = 'DRP';
    } else if (r.grade != null && r.grade !== '') {
      gradeStr = formatGrade2Decimals(r.grade);
    }
    const statusStr = r.status === 'passed' ? 'Passed' : (r.is_dropped || r.status === 'dropped' ? 'Dropped' : 'Failed');
    const termStr = r.term || `${r.academic_year || ''} ${r.semester || ''}`.trim() || '—';
    return `| \`${code}\` | ${title} | ${units} | **${gradeStr}** | ${statusStr} | ${termStr} |`;
  });

  return [
    '| Subject Code | Description | Units | Grade | Status | Academic Term |',
    '| :--- | :--- | :---: | :---: | :---: | :--- |',
    ...rows
  ].join('\n');
}

/**
 * Format official recommended subjects into a clean Markdown Table
 */
function buildRecommendationsTableMarkdown(recommendedSubjects) {
  if (!recommendedSubjects || recommendedSubjects.length === 0) {
    return [
      '| Subject Code | Description | Units | Classification | Prerequisites / Notes |',
      '| :--- | :--- | :---: | :---: | :--- |',
      '| — | No subject recommendations generated | 0 | — | Prerequisite check complete |'
    ].join('\n');
  }

  const rows = recommendedSubjects.map(s => {
    const code = s.code || s.subject_code || 'SUBJ';
    const title = String(s.title || s.subject_title || 'Curriculum Course').replace(/\|/g, '-').trim();
    const units = s.units != null ? s.units : 3;
    let classification = 'Regular Load';
    if (s.reason === 'retake') classification = 'Mandatory Retake';
    else if (s.reason === 'blocked') classification = 'Blocked (Deficiency)';
    else if (s.reason === 'advance') classification = 'Advanced Subject';
    const notes = String(s.notes || (s.reason === 'retake' ? 'Unresolved deficiency pending retake' : 'Prerequisites satisfied')).replace(/\|/g, '-').trim();
    return `| \`${code}\` | ${title} | ${units} | **${classification}** | ${notes} |`;
  });

  return [
    '| Subject Code | Description | Units | Classification | Prerequisites / Notes |',
    '| :--- | :--- | :---: | :---: | :--- |',
    ...rows
  ].join('\n');
}

/**
 * Format active deficiencies into a clean Markdown Table
 */
function buildDeficienciesTableMarkdown(activeDeficiencies) {
  if (!activeDeficiencies || activeDeficiencies.length === 0) {
    return '';
  }

  const rows = activeDeficiencies.map(d => {
    const code = d.code || 'SUBJ';
    const title = String(d.title || 'Course').replace(/\|/g, '-').trim();
    const units = d.units != null ? d.units : 3;
    const gradeStr = d.grade != null && d.grade !== '' ? formatGrade2Decimals(d.grade) : (d.status === 'dropped' ? 'DRP' : '5.00');
    const statusStr = d.status === 'dropped' ? 'Dropped' : 'Failed (Retake Required)';
    const termStr = d.term || 'Previous Term';
    return `| \`${code}\` | ${title} | ${units} | **${gradeStr}** | ${statusStr} | ${termStr} |`;
  });

  return [
    '| Subject Code | Description | Units | Grade | Status | Term Recorded |',
    '| :--- | :--- | :---: | :---: | :---: | :--- |',
    ...rows
  ].join('\n');
}

/**
 * Format student directory into a clean Markdown Table
 */
function buildStudentsTableMarkdown(students, max = 15) {
  const display = (students || []).slice(0, max);
  if (display.length === 0) {
    return [
      '| Student ID | Full Name | Program | Year Level | Status |',
      '| :--- | :--- | :--- | :---: | :---: |',
      '| — | No registered students found | — | — | — |'
    ].join('\n');
  }

  const rows = display.map(s => {
    const id = s.student_id || s.id || 'N/A';
    const name = String(s.full_name || s.name || 'Student').replace(/\|/g, '-').trim();
    const program = s.program || 'BSIT';
    const yearLevel = s.year_level || s.year || 1;
    const status = s.status || 'Active';
    return `| \`${id}\` | **${name}** | ${program} | Year ${yearLevel} | ${status} |`;
  });

  return [
    '| Student ID | Full Name | Program | Year Level | Status |',
    '| :--- | :--- | :--- | :---: | :---: |',
    ...rows
  ].join('\n');
}

/**
 * Formats academic target term as human readable string (e.g., "Year 2, 2nd Semester")
 */
function formatTargetTermText(yearLevel, semester) {
  const y = Number(yearLevel) || 1;
  const s = Number(semester) || 1;
  const semLabel = s === 3 ? 'Summer' : (s === 2 ? '2nd Semester' : '1st Semester');
  return `Year ${y}, ${semLabel}`;
}

/**
 * Classifies whether user is asking for subject recommendations, grades, or comprehensive assessment
 */
function classifyStudentQueryIntent(query) {
  if (isStudentGreetingQuery(query)) return 'greeting';
  const q = (query || '').toLowerCase();
  const isAssessment = /\b(assess|assessment|evaluat(?:e|ion)|pagsusuri|comprehensive|full\s+report|overall\s+standing|standing\s+assessment)\b/i.test(q);
  if (isAssessment) return 'comprehensive';

  const isRec = /\b(recommend|recommendation|recommended|rekomendasyon|subjects?\s*to\s*take|subjects?\s*to\s*enroll|next\s*(?:sem|semester|term)|course\s*load|curriculum\s*load|advising|courses?\s*to\s*take)\b/i.test(q);
  const isGrades = /\b(grades?|marka|score|gwa|records?|academic\s*records?|transcript|talaan(?:\s*ng\s*marka)?|passed|failed|deficienc(?:y|ies)|retakes?)\b/i.test(q);
  if (isRec && !isGrades) return 'recommendation';
  if (isGrades && !isRec) return 'grades';
  return 'comprehensive';
}

/**
 * Generates structured, professional narrative explanation accompanying student tables
 */
function generateNarrativeExplanation({ student, stats, targetTermText, recommendedSubjects, activeDeficiencies, totalRecommendedUnits, isTagalog, intent }) {
  const studentName = student.name || student.full_name || 'The student';
  const failedCount = activeDeficiencies.length;
  const gwaNum = Number(stats.gwa) || 0;
  const isDean = gwaNum > 0 && gwaNum <= 1.75 && failedCount === 0;

  if (isTagalog) {
    if (intent === 'grades') {
      if (failedCount === 0) {
        return `Matagumpay na naipasa ni **${studentName}** ang lahat ng **${stats.passedUnits} units** na may cumulative GWA na **${stats.gwa}**. Walang naitalang failing grade o deficiency sa kanyang opisyal na rekord, na nagpapatunay ng matatag at tuloy-tuloy na progreso sa BSIT curriculum.`;
      } else {
        const defCodes = activeDeficiencies.map(d => d.code).join(', ');
        return `Ang kasalukuyang cumulative GWA ni **${studentName}** ay **${stats.gwa}** na may **${stats.passedUnits} units na naipasa**. Mayroon siyang **${failedCount} deficiency** (${defCodes}) na kailangang bigyang-pansin upang mapanatili ang tamang academic standing.`;
      }
    }

    if (failedCount === 0) {
      return `Batay sa opisyal na curriculum evaluation ng GCT, si **${studentName}** ay nasa **Regular at Good Academic Standing** na may cumulative GWA na **${stats.gwa}**${isDean ? ' (Kwalipikado sa Honor Standing / Dean\'s List)' : ''}. Kumpleto at naipasa niya ang lahat ng foundational prerequisites para sa darating na **${targetTermText}**. Inirerekomenda ang buong standard curriculum load na **${totalRecommendedUnits} units** (${recommendedSubjects.length} subjects). Walang kinakailangang remedial o retake subjects bago ang enrollment.`;
    } else {
      const defCodes = activeDeficiencies.map(d => d.code).join(', ');
      return `Ayon sa pagsusuri ng curriculum, si **${studentName}** ay may cumulative GWA na **${stats.gwa}** at mayroong **${failedCount} unresolved deficiency** (${defCodes}). Alinsunod sa polisiya ng Registrar, mandatory na unahing i-retake ang mga deficient na kurso sa darating na **${targetTermText}** upang maiwasan ang pagkaantala ng higher-level subjects na nakadepende rito. Ang inirerekomendang kabuuang load ay **${totalRecommendedUnits} units** upang matiyak ang sapat na focus sa pagpasa.`;
    }
  }

  // English (Default)
  if (intent === 'grades') {
    if (failedCount === 0) {
      return `**${studentName}** has maintained a clean academic record with **${stats.passedUnits} earned units** and a cumulative GWA of **${stats.gwa}**. With zero recorded failures, the student exhibits consistent mastery across foundational and professional courses.`;
    } else {
      const defCodes = activeDeficiencies.map(d => d.code).join(', ');
      return `**${studentName}** currently holds a cumulative GWA of **${stats.gwa}** with **${stats.passedUnits} passed units**. There are **${failedCount} active subject deficiencies** (${defCodes}) on record requiring remediation to restore regular standing.`;
    }
  }

  if (failedCount === 0) {
    return `Based on the official GCT curriculum evaluation, **${studentName}** demonstrates exemplary compliance with all prerequisite sequences and is in **Good Academic Standing** with a cumulative GWA of **${stats.gwa}**${isDean ? ' (Honor / Dean\'s List Standing)' : ''}. For the upcoming **${targetTermText}**, the system recommends the standard full-time curriculum load of **${totalRecommendedUnits} units** across ${recommendedSubjects.length} courses. The student is cleared for regular online enrollment without advising restrictions.`;
  } else {
    const defCodes = activeDeficiencies.map(d => d.code).join(', ');
    return `Based on the official GCT curriculum evaluation, **${studentName}** holds a cumulative GWA of **${stats.gwa}** with **${failedCount} unresolved subject deficiency** (${defCodes}). Official advising policy mandates scheduling prerequisite retakes as the top priority for the upcoming **${targetTermText}** before higher-level dependent courses can be enrolled. The recommended course load is adjusted to **${totalRecommendedUnits} units** to promote academic recovery and prerequisite clearance.`;
  }
}

/**
 * Runs official GCT Assessment & Recommendation Engine for student
 * Queries database curriculum, prerequisites, and system settings to deterministically compute:
 * - Recommended subjects for upcoming term
 * - Active deficiencies / retakes
 * - Target advising term and total recommended units
 */
async function getStudentEvaluationData(targetStudent, records, supabase, targetTermOverride = null) {
  try {
    const program = targetStudent.program || 'BSIT';

    // 1. Fetch curriculum subjects for this student's program
    let { data: curriculumSubjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('program', program)
      .order('year_level', { ascending: true })
      .order('semester', { ascending: true });

    if (!curriculumSubjects || curriculumSubjects.length === 0) {
      const { data: allSubs } = await supabase.from('subjects').select('*');
      curriculumSubjects = allSubs || [];
    }

    // 2. Fetch prerequisites
    const { data: prerequisites } = await supabase
      .from('prerequisites')
      .select('*');

    // 3. Fetch system settings with safe defaults
    let passingThreshold = 75;
    let maxFailedPrereqs = 3;
    let activeAcademicYear = '2026-2027';

    try {
      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value');
      (settingsData || []).forEach(s => {
        if (s.key === 'passing_grade_threshold' && s.value) passingThreshold = Number(s.value) || 75;
        if (s.key === 'max_failed_prerequisites' && s.value) maxFailedPrereqs = Number(s.value) || 3;
        if (s.key === 'activeAcademicYear' && s.value) activeAcademicYear = String(s.value).trim() || '2026-2027';
      });
    } catch (e) {
      // Ignore settings fetch errors and use defaults
    }

    // 4. Run official deterministic Assessment Engine
    const evaluation = evaluateStudent({
      studentGrades: records || [],
      curriculumSubjects: curriculumSubjects || [],
      prerequisites: prerequisites || [],
      studentInfo: {
        year_level: targetStudent.year_level || targetStudent.year || 1,
        semester: targetStudent.semester || 1,
        program
      },
      passingThreshold,
      maxFailedPrereqs,
      activeAcademicYear,
      targetYearOverride: targetTermOverride?.year,
      targetSemesterOverride: targetTermOverride?.semester
    });

    const recommendedSubjects = evaluation?.recommendedSubjects || [];
    const activeDeficiencies = evaluation?.activeDeficiencies || [];
    const targetTerm = evaluation?.targetTerm || { year_level: Number(targetStudent.year_level || 1), semester: 1 };
    const totalRecommendedUnits = evaluation?.summary?.totalRecommendedUnits || recommendedSubjects.reduce((sum, s) => sum + Number(s.units || 0), 0);
    const eligibility = evaluation?.eligibility || 'eligible';

    return {
      evaluation,
      recommendedSubjects,
      activeDeficiencies,
      targetTerm,
      totalRecommendedUnits,
      eligibility
    };
  } catch (err) {
    console.error('Error running assessment engine for student in chatbot:', err.message);
    return {
      evaluation: null,
      recommendedSubjects: [],
      activeDeficiencies: [],
      targetTerm: { year_level: Number(targetStudent.year_level || 1), semester: 1 },
      totalRecommendedUnits: 0,
      eligibility: 'eligible'
    };
  }
}

/**
 * Generate a formal registrar evaluation opinion for staff (Bilingual: English default, Tagalog on demand)
 */
function generateRegistrarOpinion(student, stats, records, failedCount, isTagalog = false) {
  const gwaNum = Number(stats.gwa);
  const isAtRisk = failedCount >= 2 || (gwaNum > 2.85);

  if (isTagalog) {
    let recommendation = '';
    if (failedCount === 0) {
      recommendation = `Kwalipikado para sa regular enrollment track nang walang anumang prerequisite restrictions. Ang estudyante ay may tuloy-tuloy na progreso sa curriculum milestones.`;
    } else if (failedCount === 1) {
      recommendation = `Conditional Advising: Siguraduhing ma-enroll muna ang nag-iisang deficiency bilang mandatory retake sa darating na termino bago pahintulutan ang higher-tier courses na may prerequisite dependency.`;
    } else {
      recommendation = `Academic Intervention: Ang estudyante ay may ${failedCount} unresolved subject deficiencies. Inirerekomenda ang limitadong academic load (maximum 18 units) upang unahin ang pagpasa sa prerequisites at maiwasan ang lalong pagbaba ng cumulative GWA.`;
    }

    return `### Pagsusuri at Opinyon ng Registrar

**Profile ng Estudyante:** ${student.name || student.full_name} (${student.student_id}) — ${student.program} Year ${student.year_level || student.year || 1}
**Academic Health:** Cumulative GWA na ${stats.gwa} (${stats.passedUnits} units passed, ${failedCount} deficiencies)

**Pagsusuri ng Registrar:**
- Risk Level: ${isAtRisk ? 'Katamtaman / Nangangailangan ng Gabay' : 'Mababa / Regular Standing'}
- Prerequisite Compliance: ${failedCount === 0 ? 'Kumpleto at Sumusunod' : `${failedCount} prerequisite subject(s) na kailangang i-retake`}
- Opisyal na Rekomendasyon: ${recommendation}`;
  }

  // Default: Professional English
  let recommendation = '';
  if (failedCount === 0) {
    recommendation = `Cleared for regular enrollment track without prerequisite restrictions. The student demonstrates consistent progress across all curriculum milestones.`;
  } else if (failedCount === 1) {
    recommendation = `Advising Flag: Recommend conditional advising. Ensure the single deficiency is scheduled as a mandatory retake in the upcoming term before higher-tier subjects with prerequisite dependencies are encoded.`;
  } else {
    recommendation = `Academic Intervention Recommended: The student has ${failedCount} unresolved subject deficiencies. Advise reduced academic load (maximum 18 units) to prioritize prerequisite clearance and prevent further cumulative grade degradation.`;
  }

  return `### Registrar Evaluation & Academic Opinion

**Student Profile:** ${student.name || student.full_name} (${student.student_id}) — ${student.program} Year ${student.year_level || student.year || 1}
**Academic Health:** Cumulative GWA of ${stats.gwa} (${stats.passedUnits} units passed, ${failedCount} deficiencies)

**Registrar Assessment:**
- Risk Level: ${isAtRisk ? 'Moderate / At-Risk' : 'Low / Good Standing'}
- Prerequisite Compliance: ${failedCount === 0 ? 'Fully Compliant' : `${failedCount} prerequisite subject(s) pending retake`}
- Official Recommendation: ${recommendation}`;
}

/**
 * Detect requested file format from user query (word, excel, text, pdf)
 */
function detectRequestedFileFormat(query) {
  const q = (query || '').toLowerCase();
  if (/\b(word|docx?|ms\s*word|doc\s*file|word\s*file|word\s*document|in\s*word)\b/i.test(q)) {
    return 'word';
  }
  if (/\b(excel|csv|spreadsheet|xlsx?|sheets?|in\s*excel)\b/i.test(q)) {
    return 'excel';
  }
  if (/\b(txt|text\s*file|notepad|plain\s*text|in\s*text)\b/i.test(q)) {
    return 'text';
  }
  if (/\b(pdf)\b/i.test(q)) {
    return 'word'; // Word HTML formats cleanly as an official printable/editable document
  }
  return 'excel'; // Default format
}

/**
 * Extract target academic term and semester from a natural language query
 * e.g., "student 12310 2nd year first sem" -> { year: 2, semester: '1', target_term: '2nd Year • 1st Sem', isSpecificFilter: true }
 */
function extractTargetTermAndSemester(query, studentYear = null) {
  const q = (query || '').toLowerCase();

  // 1. Detect Year Level
  let detectedYear = null;
  if (/\b(1st|first|1)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*1\b/i.test(q)) {
    detectedYear = 1;
  } else if (/\b(2nd|second|2)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*2\b/i.test(q)) {
    detectedYear = 2;
  } else if (/\b(3rd|third|3)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*3\b/i.test(q)) {
    detectedYear = 3;
  } else if (/\b(4th|fourth|4)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*4\b/i.test(q)) {
    detectedYear = 4;
  }

  // 2. Detect Semester
  let detectedSem = null; // '1' | '2' | 'summer'
  if (/\b(1st|first|1)\s*(sem|semester)\b/i.test(q) || /\b(sem|semester)\s*1\b/i.test(q)) {
    detectedSem = '1';
  } else if (/\b(2nd|second|2)\s*(sem|semester)\b/i.test(q) || /\b(sem|semester)\s*2\b/i.test(q)) {
    detectedSem = '2';
  } else if (/\b(summer|midyear)\b/i.test(q)) {
    detectedSem = 'summer';
  }

  // 3. Detect Academic Year (e.g. 2024-2025, 2025-2026)
  const ayMatch = q.match(/\b((?:19|20)\d{2}-(?:19|20)\d{2})\b/);
  const detectedAY = ayMatch ? ayMatch[1] : null;

  const isSpecificFilter = Boolean(detectedYear !== null || detectedSem !== null || detectedAY !== null);

  // If year was not explicitly mentioned, but student's year level is known and semester was requested:
  const effectiveYear = detectedYear || (detectedSem && Number(studentYear) >= 1 && Number(studentYear) <= 4 ? Number(studentYear) : null);

  let targetTerm = null;
  if (detectedAY && detectedSem) {
    const semLabel = detectedSem === 'summer' ? 'Summer' : (detectedSem === '2' ? '2nd Sem' : '1st Sem');
    targetTerm = `${detectedAY} ${semLabel}`;
  } else if (detectedAY) {
    targetTerm = `AY ${detectedAY}`;
  } else if (effectiveYear && detectedSem && detectedSem !== 'summer') {
    const yrLabel = effectiveYear === 1 ? '1st' : effectiveYear === 2 ? '2nd' : effectiveYear === 3 ? '3rd' : '4th';
    const semLabel = detectedSem === '2' ? '2nd' : '1st';
    targetTerm = `${yrLabel} Year • ${semLabel} Sem`;
  } else if (effectiveYear && !detectedSem) {
    const yrLabel = effectiveYear === 1 ? '1st' : effectiveYear === 2 ? '2nd' : effectiveYear === 3 ? '3rd' : '4th';
    targetTerm = `${yrLabel} Year`;
  } else if (detectedSem) {
    targetTerm = detectedSem === 'summer' ? 'Summer' : (detectedSem === '2' ? '2nd Semester' : '1st Semester');
  }

  return {
    year: effectiveYear,
    explicitYear: detectedYear,
    semester: detectedSem,
    academic_year: detectedAY,
    target_term: targetTerm,
    isSpecificFilter
  };
}

/**
 * Checks if an academic grade record matches the requested year level, semester, and/or academic year.
 */
function matchesRecordTerm(record, targetYear, targetSem, targetAcademicYear = null) {
  if (!record) return false;

  // Academic Year check (if targetAcademicYear was requested, e.g. "2025-2026")
  if (targetAcademicYear) {
    const cleanAY = String(targetAcademicYear).trim().toLowerCase();
    const rAY = String(record.academic_year || '').trim().toLowerCase();
    const rTerm = String(record.term || '').trim().toLowerCase();
    if (!rAY.includes(cleanAY) && !rTerm.includes(cleanAY)) {
      return false;
    }
  }

  // Year level check (if targetYear was requested)
  if (targetYear !== null && targetYear !== undefined) {
    const rYear = Number(record.year_level || record.enrolled_year_level || record.curriculum_year_level || 0);
    const termStr = String(record.term || '').toLowerCase();
    const yrWord = targetYear === 1 ? '1st' : targetYear === 2 ? '2nd' : targetYear === 3 ? '3rd' : '4th';
    const hasYrWord = termStr.includes(`${yrWord} year`) || termStr.includes(`year ${targetYear}`) || termStr.includes(`yr ${targetYear}`);
    if (rYear !== targetYear && !hasYrWord) {
      return false;
    }
  }

  // Semester check (if targetSem was requested)
  if (targetSem !== null && targetSem !== undefined) {
    const termStr = String(record.term || '').toLowerCase();
    const rSem = String(record.semester || '').toLowerCase();

    if (targetSem === 'summer') {
      const isSummer = termStr.includes('summer') || termStr.includes('midyear') || rSem === 'summer' || rSem === '3';
      if (!isSummer) return false;
    } else if (targetSem === '2') {
      const isSem2 = termStr.includes('2nd sem') || termStr.includes('second sem') || termStr.includes('2nd semester') || termStr.includes('sem 2') || termStr.includes('semester 2') || rSem === '2' || rSem === 'second';
      if (!isSem2) return false;
    } else if (targetSem === '1') {
      const isSem1 = (termStr.includes('1st sem') || termStr.includes('first sem') || termStr.includes('1st semester') || termStr.includes('sem 1') || termStr.includes('semester 1') || rSem === '1' || rSem === 'first') && !termStr.includes('2nd sem') && !termStr.includes('2nd semester');
      if (!isSem1) return false;
    }
  }

  return true;
}

/**
 * Extract distinct academic terms and semester labels from records in chronological order
 */
function getDistinctTermsList(records) {
  if (!Array.isArray(records) || records.length === 0) return [];
  const map = new Map();
  records.forEach(r => {
    const rawTerm = (r.term || '').trim();
    if (!rawTerm) return;
    if (!map.has(rawTerm)) {
      const yr = Number(r.year_level || r.enrolled_year_level || r.curriculum_year_level || 0);
      const yrLabel = yr ? (yr === 1 ? '1st Year' : yr === 2 ? '2nd Year' : yr === 3 ? '3rd Year' : `${yr}th Year`) : '';
      const semLabel = r.semester === 'summer' ? 'Summer' : (r.semester === '2' ? '2nd Sem' : '1st Sem');
      const alias = yrLabel ? `${yrLabel} • ${semLabel}` : '';
      map.set(rawTerm, {
        term: rawTerm,
        academicYear: r.academic_year || '',
        semester: r.semester || '',
        yearLevel: yr || null,
        displayLabel: alias ? `${rawTerm} (${alias})` : rawTerm
      });
    }
  });
  return Array.from(map.values());
}

/**
 * Format student evaluation / grades as a downloadable CSV/Excel spreadsheet string
 * When recommendations are queried, the Recommended Subjects table is placed at top.
 * When grades are queried, the official grade sheet for that term (or all terms) is formatted.
 */
function generateStudentCsv(student, records, gwa, options = {}) {
  const {
    intent = (options.recommendedSubjects && options.recommendedSubjects.length > 0 ? 'comprehensive' : 'grades'),
    recommendedSubjects = [],
    activeDeficiencies = [],
    targetTermText = '',
    totalRecommendedUnits = 0,
    enrollmentStatus = null,
    isFilteredByTerm = false,
    termLabel = ''
  } = options;

  const rows = [];
  const studentId = student.student_id || student.id || 'N/A';
  const cleanId = String(studentId).replace(/^GCT-/i, '').trim();
  const studentName = (student.name || student.full_name || 'Student').replace(/"/g, '""');
  const program = (student.program || 'BSIT').replace(/"/g, '""');
  const yearLevel = student.year_level || student.year || 1;

  // 1. PRIMARY TABLE: OFFICIAL GRADE SHEET / ACADEMIC RECORDS
  // Standard format matching institutional export:
  // Student ID, Student Name, Program, Year Level, Subject Code, Subject Title, Units, Grade, Status, Academic Term
  const gradeHeaders = ['Student ID', 'Student Name', 'Program', 'Year Level', 'Subject Code', 'Subject Title', 'Units', 'Grade', 'Status', 'Academic Term'];
  rows.push(gradeHeaders.join(','));

  if (records && records.length > 0) {
    records.forEach(r => {
      const code = (r.code || r.subject?.code || r.subject || r.subject_code || r.subject_id || 'SUBJ').replace(/"/g, '""');
      const title = (r.title || r.subject?.title || r.subject_title || 'Curriculum Course').replace(/"/g, '""');
      const units = r.units != null ? Number(r.units) : (r.subject?.units != null ? Number(r.subject.units) : 3);

      const isDropped = Boolean(r.is_dropped || r.isDropped || r.status === 'dropped' || String(r.raw_grade || r.rawGrade) === '9' || String(r.raw_grade || r.rawGrade).toUpperCase() === 'DRP');
      const isNotTaken = r.status === 'not_taken';

      let finalGrade = 'N/A';
      let finalStatus = 'passed';

      if (isDropped) {
        finalGrade = 'DRP';
        finalStatus = 'dropped';
      } else if (isNotTaken) {
        finalGrade = 'N/A';
        finalStatus = 'not_taken';
      } else if (r.grade != null && r.grade !== '' && !isNaN(Number(r.grade))) {
        const num = Number(r.grade);
        finalGrade = num.toFixed(2);
        finalStatus = (r.status === 'failed' || num > 3.0 || num === 5) ? 'failed' : 'passed';
      } else if (r.raw_grade != null && r.raw_grade !== '' && !isNaN(parseFloat(String(r.raw_grade)))) {
        const num = parseFloat(String(r.raw_grade));
        finalGrade = num.toFixed(2);
        finalStatus = (r.status === 'failed' || num > 3.0 || num === 5) ? 'failed' : 'passed';
      } else {
        finalGrade = 'N/A';
        finalStatus = r.status || 'failed';
      }

      const term = (r.term || r.curriculumTerm || `${r.academic_year || ''} ${r.semester || ''}`.trim() || (isFilteredByTerm ? termLabel : 'Academic Record')).replace(/"/g, '""');
      const recYear = r.year_level || r.yearLevel || r.enrolled_year_level || r.curriculum_year_level || yearLevel || 1;

      rows.push([
        `"${cleanId}"`,
        `"${studentName}"`,
        `"${program}"`,
        recYear,
        `"${code}"`,
        `"${title}"`,
        units,
        `"${finalGrade}"`,
        `"${finalStatus}"`,
        `"${term}"`
      ].join(','));
    });
  } else if (!recommendedSubjects || recommendedSubjects.length === 0) {
    rows.push([
      `"${cleanId}"`,
      `"${studentName}"`,
      `"${program}"`,
      yearLevel,
      `"N/A"`,
      `"No graded subjects recorded yet"`,
      0,
      `"N/A"`,
      `"N/A"`,
      `"N/A"`
    ].join(','));
  }

  // 2. UNDER THAT: RECOMMENDED SUBJECTS (Only if intent is recommendation or comprehensive)
  if (intent !== 'grades' && recommendedSubjects && recommendedSubjects.length > 0) {
    rows.push('');
    rows.push(`"RECOMMENDED SUBJECTS (${(targetTermText || 'Upcoming Term').replace(/"/g, '""')})"`);
    const recHeaders = ['Student ID', 'Student Name', 'Program', 'Year Level', 'Subject Code', 'Subject Title', 'Units', 'Classification', 'Prerequisites / Remarks', 'Target Term'];
    rows.push(recHeaders.map(h => `"${h}"`).join(','));

    recommendedSubjects.forEach(rec => {
      const cat = (rec.reason === 'retake' || rec.isRetake ? 'Retake Priority' : 'Regular Track').replace(/"/g, '""');
      const code = (rec.code || '').replace(/"/g, '""');
      const title = (rec.title || '').replace(/"/g, '""');
      const units = Number(rec.units) || 3;
      const remarks = (rec.notes || rec.remarks || rec.prerequisites || 'None').replace(/"/g, '""');
      const recYear = rec.year_level || rec.year || yearLevel || 1;

      rows.push([
        `"${cleanId}"`,
        `"${studentName}"`,
        `"${program}"`,
        recYear,
        `"${code}"`,
        `"${title}"`,
        units,
        `"${cat}"`,
        `"${remarks}"`,
        `"${(targetTermText || 'Upcoming Term').replace(/"/g, '""')}"`
      ].join(','));
    });
  }

  // 3. UNDER THAT: ACTIVE DEFICIENCIES (If any)
  if (activeDeficiencies && activeDeficiencies.length > 0) {
    rows.push('');
    rows.push(`"ACTIVE DEFICIENCIES / RETAKE PRIORITY"`);
    const defHeaders = ['Student ID', 'Student Name', 'Program', 'Year Level', 'Subject Code', 'Subject Title', 'Units', 'Grade', 'Status', 'Term Recorded'];
    rows.push(defHeaders.map(h => `"${h}"`).join(','));

    activeDeficiencies.forEach(d => {
      const code = (d.code || '').replace(/"/g, '""');
      const title = (d.title || '').replace(/"/g, '""');
      const units = Number(d.units) || 3;
      const grade = d.grade != null ? formatGrade2Decimals(d.grade) : '5.00';
      const status = (d.status || 'failed').replace(/"/g, '""');
      const term = (d.term || 'Recorded Deficiency').replace(/"/g, '""');
      const dYear = d.year_level || d.year || yearLevel || 1;

      rows.push([
        `"${cleanId}"`,
        `"${studentName}"`,
        `"${program}"`,
        dYear,
        `"${code}"`,
        `"${title}"`,
        units,
        grade,
        `"${status}"`,
        `"${term}"`
      ].join(','));
    });
  }

  return rows.join('\r\n');
}

/**
 * Format multi-student academic records as a downloadable Excel CSV file (.csv)
 * Each student's block is clearly separated by blank space rows for clean viewing
 */
function generateMultiStudentCsv(studentsDataList) {
  const allRows = [];

  // Report Header Banner
  allRows.push(`"GCT REGISTRAR OPERATIONS — MULTI-STUDENT ACADEMIC REPORT"`);
  allRows.push(`"Report Date:","${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}"`);
  allRows.push(`"Total Students Evaluated:","${studentsDataList.length}"`);
  allRows.push('');

  studentsDataList.forEach((item, index) => {
    const { student, records, gwa, recommendations, targetTermText, enrollmentStatus } = item;
    const cleanId = String(student.student_id || student.id || 'N/A').replace(/^GCT-/i, '').trim();
    const studentName = (student.name || student.full_name || 'Student').replace(/"/g, '""');
    const program = (student.program || 'BSIT').replace(/"/g, '""');
    const yearLevel = student.year_level || student.year || 1;
    const statusText = (enrollmentStatus?.statusLabel || 'Active').replace(/"/g, '""');

    // Student Header Card
    allRows.push(`"================================================================================"`);
    allRows.push(`"STUDENT #${index + 1}:","${studentName}","(ID: ${cleanId})"`);
    allRows.push(`"Program:","${program}","Year Level:","${yearLevel}","Status:","${statusText}"`);
    allRows.push(`"Cumulative GWA:","${gwa || 'N/A'}","Last Enrolled Term:","${enrollmentStatus?.lastEnrolledTerm || 'N/A'}"`);
    allRows.push('');

    // If recommendations are present, output Recommended Subjects block
    if (recommendations && recommendations.length > 0) {
      allRows.push(`"RECOMMENDED SUBJECTS (${targetTermText || 'Upcoming Term'})"`);
      allRows.push(['Category', 'Subject Code', 'Subject Title', 'Units', 'Prerequisites / Remarks'].map(h => `"${h}"`).join(','));
      recommendations.forEach(rec => {
        const cat = (rec.reason === 'retake' || rec.isRetake ? 'Retake' : 'Regular Track').replace(/"/g, '""');
        const code = (rec.code || '').replace(/"/g, '""');
        const title = (rec.title || '').replace(/"/g, '""');
        const units = Number(rec.units) || 3;
        const remarks = (rec.notes || rec.remarks || rec.prerequisites || 'None').replace(/"/g, '""');
        allRows.push(`"${cat}","${code}","${title}",${units},"${remarks}"`);
      });
      allRows.push('');
    }

    // Grade Records table (Exact 10 columns matching institutional format)
    allRows.push(['Student ID', 'Student Name', 'Program', 'Year Level', 'Subject Code', 'Subject Title', 'Units', 'Grade', 'Status', 'Academic Term'].join(','));
    if (!records || records.length === 0) {
      allRows.push([`"${cleanId}"`, `"${studentName}"`, `"${program}"`, yearLevel, `"N/A"`, `"No recorded subjects found"`, 0, `"N/A"`, `"N/A"`, `"N/A"`].join(','));
    } else {
      records.forEach(r => {
        const code = (r.code || '').replace(/"/g, '""');
        const title = (r.title || '').replace(/"/g, '""');
        const units = Number(r.units) || 3;
        const isFailedOrDef = r.status === 'failed' || (!r.is_dropped && r.grade != null && Number(r.grade) > 3.0);
        const isDropped = r.is_dropped || r.status === 'dropped';
        let grade = 'N/A';
        if (isDropped) {
          grade = 'N/A';
        } else if (r.grade != null && !isNaN(Number(r.grade))) {
          grade = Number(r.grade).toFixed(2);
        } else if (isFailedOrDef) {
          grade = '5.00';
        }
        const status = (isDropped ? 'dropped' : (isFailedOrDef ? 'failed' : (r.status || 'passed'))).replace(/"/g, '""');
        const term = (r.term || 'Academic Record').replace(/"/g, '""');
        const recYear = r.year_level || r.year || yearLevel || 1;
        allRows.push([
          `"${cleanId}"`,
          `"${studentName}"`,
          `"${program}"`,
          recYear,
          `"${code}"`,
          `"${title}"`,
          units,
          `"${grade}"`,
          `"${status}"`,
          `"${term}"`
        ].join(','));
      });
    }

    // Two blank lines ("space pag dating sa pag kakasunod") before next student
    allRows.push('');
    allRows.push('');
  });

  return allRows.join('\r\n');
}

/**
 * Detects the student's enrollment timeline, last enrolled term, and stopped/lapsed status
 */
function getStudentEnrollmentStatus(student, records, activeAcademicYear = '2026-2027') {
  if (!records || records.length === 0) {
    return {
      lastEnrolledTerm: 'No enrollment records on file',
      lastEnrolledAcademicYear: null,
      lastEnrolledSem: null,
      lastEnrolledYearLevel: student.year_level || student.year || 1,
      isStoppedOrLapsed: false,
      statusLabel: 'No records on file'
    };
  }

  let latestYearStart = 0;
  let latestSemRank = 0;
  let latestTermRecord = null;

  records.forEach(r => {
    const ay = (r.academic_year || r.academicYear || r.term?.match(/\d{4}-\d{4}/)?.[0] || '').trim();
    const semStr = String(r.semester || r.term || '').toLowerCase();
    let semRank = 1;
    if (semStr.includes('summer') || semStr === '3') semRank = 3;
    else if (semStr.includes('2nd') || semStr.includes('second') || semStr === '2') semRank = 2;

    const startYr = parseInt(ay.split('-')[0] || '0', 10);
    if (startYr > latestYearStart || (startYr === latestYearStart && semRank > latestSemRank)) {
      latestYearStart = startYr;
      latestSemRank = semRank;
      latestTermRecord = {
        term: r.term || `${ay} ${semRank === 3 ? 'Summer' : (semRank === 2 ? '2nd Sem' : '1st Sem')}`,
        academicYear: ay,
        semRank,
        yearLevel: r.year_level || r.year || r.enrolled_year_level || student.year_level || student.year || 1
      };
    }
  });

  const lastTerm = latestTermRecord ? latestTermRecord.term : 'Unknown';
  let isStoppedOrLapsed = false;
  if (latestYearStart > 0 && activeAcademicYear) {
    const activeStart = parseInt(String(activeAcademicYear).split('-')[0] || '0', 10);
    if (activeStart - latestYearStart >= 2) {
      isStoppedOrLapsed = true;
    }
  }

  const explicitStatus = String(student.status || '').toLowerCase();
  if (explicitStatus === 'inactive' || explicitStatus === 'stopped' || explicitStatus === 'dropped' || explicitStatus === 'lapsed') {
    isStoppedOrLapsed = true;
  }

  return {
    lastEnrolledTerm: lastTerm,
    lastEnrolledAcademicYear: latestTermRecord?.academicYear,
    lastEnrolledSem: latestTermRecord?.semRank === 3 ? 'Summer' : (latestTermRecord?.semRank === 2 ? '2nd Sem' : '1st Sem'),
    lastEnrolledYearLevel: latestTermRecord?.yearLevel || student.year_level || 1,
    isStoppedOrLapsed,
    statusLabel: isStoppedOrLapsed
      ? `Inactive / Stopped (Last attended: ${lastTerm})`
      : `Active (Last enrolled: ${lastTerm})`
  };
}

/**
 * Format academic record as a downloadable Microsoft Word document (.doc)
 */
function generateStudentWord(student, records, gwa, options = {}) {
  const {
    intent = 'grades',
    recommendedSubjects = [],
    activeDeficiencies = [],
    targetTermText = '',
    totalRecommendedUnits = 0,
    enrollmentStatus = null,
    isFilteredByTerm = false,
    termLabel = ''
  } = options;

  const studentId = student.student_id || student.id || 'N/A';
  const cleanId = String(studentId).replace(/^GCT-/i, '').trim();
  const studentName = student.name || student.full_name || 'Student';
  const program = student.program || 'BSIT';
  const yearLevel = student.year_level || student.year || 1;
  const statusLabel = enrollmentStatus?.statusLabel || 'Active';

  const isRec = intent === 'recommendation' || (recommendedSubjects && recommendedSubjects.length > 0 && intent !== 'grades');

  const recRowsHtml = (!recommendedSubjects || recommendedSubjects.length === 0)
    ? `<tr><td colspan="5" style="text-align:center; padding:12px; color:#64748b;">No recommended subjects recorded.</td></tr>`
    : recommendedSubjects.map(rec => `
      <tr>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; font-family:Calibri,sans-serif; font-size:10.5pt; font-weight:bold;">${rec.code || ''}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; font-family:Calibri,sans-serif; font-size:10.5pt;">${rec.title || ''}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; text-align:center; font-family:Calibri,sans-serif; font-size:10.5pt;">${rec.units || 3}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; text-align:center; font-family:Calibri,sans-serif; font-size:10.5pt; color:${rec.reason === 'retake' ? '#b91c1c' : '#1e3a8a'};">${rec.reason === 'retake' ? 'Retake Priority' : 'Regular'}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; font-family:Calibri,sans-serif; font-size:10pt;">${rec.notes || rec.remarks || 'None'}</td>
      </tr>
    `).join('');

  const gradeRowsHtml = (!records || records.length === 0)
    ? `<tr><td colspan="5" style="text-align:center; padding:12px; color:#64748b;">No graded subjects recorded yet.</td></tr>`
    : records.map(r => `
      <tr>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; font-family:Calibri,sans-serif; font-size:10.5pt;">${r.code || ''}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; font-family:Calibri,sans-serif; font-size:10.5pt;">${r.title || ''}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; text-align:center; font-family:Calibri,sans-serif; font-size:10.5pt;">${r.units || 3}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; text-align:center; font-weight:bold; font-family:Calibri,sans-serif; font-size:10.5pt;">${r.grade != null ? r.grade : 'N/A'}</td>
        <td style="border:1px solid #cbd5e1; padding:8px 12px; text-align:center; font-family:Calibri,sans-serif; font-size:10.5pt; color:${r.status === 'passed' ? '#166534' : '#991b1b'};">${r.status === 'passed' ? 'PASSED' : 'FAILED'}</td>
      </tr>
    `).join('');

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${isRec ? 'Subject Recommendations' : 'Academic Record'} - ${studentName}</title>
<style>
  body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1e293b; }
  .header { text-align: center; border-bottom: 3px double #1e3a8a; padding-bottom: 14px; margin-bottom: 24px; }
  .title { font-size: 18pt; font-weight: bold; color: #1e3a8a; letter-spacing: 0.5px; }
  .subtitle { font-size: 11pt; color: #475569; margin-top: 4px; font-weight: 600; }
  .meta-box { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 14px 18px; margin-bottom: 20px; border-radius: 6px; }
  .meta-table { width: 100%; border-collapse: collapse; }
  .meta-table td { padding: 5px 8px; font-size: 11pt; }
  .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
  .data-table th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #1e3a8a; padding: 10px 12px; font-size: 11pt; text-align: left; }
  .footer { margin-top: 36px; font-size: 9.5pt; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">GARCIA COLLEGE OF TECHNOLOGY</div>
    <div class="subtitle">OFFICE OF THE REGISTRAR — OFFICIAL ACADEMIC REPORT</div>
  </div>

  <div class="meta-box">
    <table class="meta-table">
      <tr>
        <td><strong>Student Name:</strong> ${studentName}</td>
        <td><strong>Student ID:</strong> ${cleanId}</td>
      </tr>
      <tr>
        <td><strong>Degree Program:</strong> ${program}</td>
        <td><strong>Year Level:</strong> Year ${yearLevel}</td>
      </tr>
      <tr>
        <td><strong>Enrollment Status:</strong> ${statusLabel}</td>
        <td><strong>Cumulative GWA:</strong> <span style="color:#1e3a8a; font-weight:bold;">${gwa || 'N/A'}</span></td>
      </tr>
      ${isRec ? `<tr><td><strong>Target Advising Term:</strong> ${targetTermText}</td><td><strong>Recommended Load:</strong> ${totalRecommendedUnits} units</td></tr>` : ''}
    </table>
  </div>

  ${isRec ? `
  <h3 style="color:#1e3a8a; margin-bottom:8px; font-size:13pt;">Recommended Course Load (${targetTermText} • ${totalRecommendedUnits} Units)</h3>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 18%;">Subject Code</th>
        <th style="width: 42%;">Subject Title</th>
        <th style="width: 10%; text-align:center;">Units</th>
        <th style="width: 12%; text-align:center;">Category</th>
        <th style="width: 18%;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${recRowsHtml}
    </tbody>
  </table>
  ` : ''}

  <h3 style="color:#1e3a8a; margin-bottom:8px; font-size:13pt;">${isRec ? 'Historical Coursework Background (Reference)' : (isFilteredByTerm ? `Grade Sheet (${termLabel})` : 'Curriculum Grades & Course Completion')}</h3>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 18%;">Subject Code</th>
        <th style="width: 46%;">Subject Title</th>
        <th style="width: 12%; text-align:center;">Units</th>
        <th style="width: 12%; text-align:center;">Grade</th>
        <th style="width: 12%; text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${gradeRowsHtml}
    </tbody>
  </table>

  <div class="footer">
    This document was generated by the Garcia College of Technology Assessment and Advising System.
  </div>
</body>
</html>`;
}

/**
 * Format academic record as a downloadable Plain Text file (.txt)
 */
function generateStudentText(student, records, gwa, options = {}) {
  const {
    intent = 'grades',
    recommendedSubjects = [],
    activeDeficiencies = [],
    targetTermText = '',
    totalRecommendedUnits = 0,
    enrollmentStatus = null,
    isFilteredByTerm = false,
    termLabel = ''
  } = options;

  const cleanId = String(student.student_id || student.id || 'N/A').replace(/^GCT-/i, '').trim();
  const isRec = intent === 'recommendation' || (recommendedSubjects && recommendedSubjects.length > 0 && intent !== 'grades');

  const lines = [
    '====================================================================',
    '                   GARCIA COLLEGE OF TECHNOLOGY                     ',
    `              OFFICE OF THE REGISTRAR - ${isRec ? 'RECOMMENDATIONS' : 'ACADEMIC RECORD'}             `,
    '====================================================================',
    `Student Name: ${student.name || student.full_name || 'Student'}`,
    `Student ID:   ${cleanId}`,
    `Program:      ${student.program || 'BSIT'}`,
    `Year Level:   Year ${student.year_level || student.year || 1}`,
    `Enrollment:   ${enrollmentStatus?.statusLabel || 'Active'}`,
    `Cumulative GWA: ${gwa || 'N/A'}`,
    isRec ? `Target Term:  ${targetTermText} (${totalRecommendedUnits} Units)` : (isFilteredByTerm ? `Selected Term: ${termLabel}` : ''),
    `Date Generated: ${new Date().toLocaleString()}`,
    '--------------------------------------------------------------------'
  ].filter(Boolean);

  if (isRec && recommendedSubjects && recommendedSubjects.length > 0) {
    lines.push(`\n--- RECOMMENDED SUBJECTS FOR ${targetTermText} ---`);
    lines.push('CODE       | TITLE                                | UNITS | CATEGORY');
    lines.push('--------------------------------------------------------------------');
    recommendedSubjects.forEach(rec => {
      const code = (rec.code || '').padEnd(10, ' ');
      const title = (rec.title || '').substring(0, 36).padEnd(36, ' ');
      const units = String(rec.units || 3).padEnd(5, ' ');
      const cat = (rec.reason === 'retake' ? 'RETAKE' : 'REGULAR').padEnd(8, ' ');
      lines.push(`${code} | ${title} | ${units} | ${cat}`);
    });
    lines.push('--------------------------------------------------------------------');
  }

  lines.push(`\n--- ${isRec ? 'HISTORICAL GRADE RECORDS' : 'ACADEMIC GRADE SHEET'} ---`);
  lines.push('CODE       | TITLE                                | UNITS | GRADE | STATUS');
  lines.push('--------------------------------------------------------------------');

  if (!records || records.length === 0) {
    lines.push('No graded subjects recorded yet.');
  } else {
    records.forEach(r => {
      const code = (r.code || '').padEnd(10, ' ');
      const title = (r.title || '').substring(0, 36).padEnd(36, ' ');
      const units = String(r.units || 3).padEnd(5, ' ');
      const grade = String(r.grade != null ? r.grade : 'N/A').padEnd(5, ' ');
      const status = (r.status || 'passed').toUpperCase();
      lines.push(`${code} | ${title} | ${units} | ${grade} | ${status}`);
    });
  }

  lines.push('====================================================================');
  return lines.join('\r\n');
}

/**
 * Format a list of students as a downloadable CSV spreadsheet
 */
function generateStudentsListCsv(studentsList, title = 'GCT_Students_Report') {
  const headers = ['Student ID', 'Full Name', 'Program', 'Year Level', 'Status'];
  const rows = [headers.join(',')];

  for (const s of studentsList) {
    rows.push([
      `"${s.student_id || s.id || ''}"`,
      `"${(s.name || s.full_name || '').replace(/"/g, '""')}"`,
      `"${s.program || 'BSIT'}"`,
      `"${s.year_level || s.year || 1}"`,
      `"${s.status || s.approval_status || 'approved'}"`
    ].join(','));
  }

  return rows.join('\r\n');
}

/**
 * Format a list of students as a downloadable Word document (.doc)
 */
function generateStudentsListWord(studentsList, title = 'GCT Students Directory') {
  const rowsHtml = studentsList.map(s => `
    <tr>
      <td style="border:1px solid #cbd5e1; padding:6px 10px; font-family:Calibri,sans-serif;">${s.student_id || s.id || ''}</td>
      <td style="border:1px solid #cbd5e1; padding:6px 10px; font-family:Calibri,sans-serif; font-weight:600;">${s.name || s.full_name || ''}</td>
      <td style="border:1px solid #cbd5e1; padding:6px 10px; font-family:Calibri,sans-serif;">${s.program || 'BSIT'}</td>
      <td style="border:1px solid #cbd5e1; padding:6px 10px; font-family:Calibri,sans-serif; text-align:center;">Year ${s.year_level || s.year || 1}</td>
      <td style="border:1px solid #cbd5e1; padding:6px 10px; font-family:Calibri,sans-serif; text-align:center;">${s.status || s.approval_status || 'approved'}</td>
    </tr>
  `).join('');

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${title}</title>
<style>
  body { font-family: Calibri, sans-serif; margin: 30px; color: #1e293b; }
  h2 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
  p { font-size: 10pt; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th { background-color: #1e3a8a; color: white; padding: 8px 10px; text-align: left; border: 1px solid #1e3a8a; font-size: 10.5pt; }
</style>
</head>
<body>
  <h2>GARCIA COLLEGE OF TECHNOLOGY — ${title}</h2>
  <p>Generated on: ${new Date().toLocaleString()}</p>
  <table>
    <thead><tr><th>Student ID</th><th>Full Name</th><th>Program</th><th>Year</th><th>Status</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;
}

/**
 * Calculate basic academic metrics from grade records
 */
function calculateStudentStats(records) {
  let totalUnits = 0;
  let totalGradePoints = 0;
  let passedUnits = 0;
  let failedUnits = 0;
  let passedCount = 0;
  let failedCount = 0;

  records.forEach(r => {
    if (r.status === 'dropped' || r.is_dropped) {
      return;
    }
    const u = Number(r.units) || 3;
    const g = Number(r.grade);
    if (!isNaN(g) && g > 0) {
      totalUnits += u;
      totalGradePoints += g * u;
      if (r.status === 'passed' || (g <= 3.0 && g >= 1.0) || g >= 75) {
        passedUnits += u;
        passedCount++;
      } else {
        failedUnits += u;
        failedCount++;
      }
    } else if (r.status === 'passed') {
      passedUnits += u;
      passedCount++;
    } else if (r.status === 'failed') {
      failedUnits += u;
      failedCount++;
    }
  });

  const gwa = totalUnits > 0 ? (totalGradePoints / totalUnits).toFixed(2) : 'N/A';
  return { totalUnits, passedUnits, failedUnits, passedCount, failedCount, gwa };
}

function normalizeAcademicSemester(value) {
  const semester = String(value || '').toLowerCase();
  if (/summer|midyear/.test(semester)) return 'summer';
  if (/second|2nd|\b2\b/.test(semester)) return '2';
  if (/first|1st|\b1\b/.test(semester)) return '1';
  return null;
}

function hasRecordForAcademicTerm(records, academicYear, semester) {
  if (!academicYear || !semester) return false;
  return records.some(record => {
    const term = String(record.term || '');
    const recordYear = record.academic_year || term.match(/\d{4}-\d{4}/)?.[0];
    return String(recordYear || '') === String(academicYear) &&
      normalizeAcademicSemester(record.semester || term) === normalizeAcademicSemester(semester);
  });
}

function isEnrollmentEligibilityQuery(query) {
  const asksEligibility = /\b(eligible|applicable|qualified|ready|pwede|puwede|maaari|kaya ko|can i|may i|am i|dapat ba)\b/i.test(query);
  const asksEnrollment = /\b(enroll|enrol|enrollment|enrolment|mag[-\s]?enroll|registration|next year|\d(?:st|nd|rd|th)\s+year|year\s*\d)\b/i.test(query);
  return asksEligibility && asksEnrollment;
}

function buildEnrollmentEligibilityResponse(query, student, records, activeTerm, isTagalog) {
  if (!isEnrollmentEligibilityQuery(query)) return null;

  const currentYear = Number(student.year_level || student.year) || 1;
  const nextYear = Math.min(currentYear + 1, 4);
  const hasActiveTermGrades = activeTerm && hasRecordForAcademicTerm(
    records,
    activeTerm.academicYear,
    activeTerm.semester
  );
  const activeYear = activeTerm?.academicYear;
  const semesterLabel = activeTerm?.semester === '2'
    ? '2nd semester'
    : activeTerm?.semester === '1' ? '1st semester' : 'summer term';
  const latestTerm = records.map(record => record.term).filter(Boolean).sort().at(-1);

  if (isTagalog) {
    if (!activeTerm) {
      return `Hindi ko pa makukumpirma kung maaari ka nang mag-enroll sa Year ${nextYear} dahil walang ma-verify na kasalukuyang academic year at semester sa system settings. Pakikumpirma muna ito sa Registrar.\n\nNais mo bang suriin muna ang iyong kasalukuyang mga marka o talaan ng mga naipasang kurso?`;
    }
    if (!hasActiveTermGrades) {
      return `Hindi pa makukumpirma kung maaari ka nang mag-enroll sa Year ${nextYear}. Nasa Year ${currentYear} ka ayon sa kasalukuyang student record. Ang active term ay ${activeYear} ${semesterLabel}, pero wala pang grade record para rito${latestTerm ? `; ang pinakahuling nasa system ay ${latestTerm}` : ''}. Hindi sapat ang bilang ng mga naipasang subject o units para ideklarang tapos na ang kasalukuyang taon. Hintayin munang ma-release at ma-encode ang grades ng active semester, saka ipa-check sa Registrar ang lahat ng required subjects at prerequisites bago mag-enroll sa susunod na taon.\n\nNais mo bang tingnan ang iyong mga inirerekomendang asignatura para sa kasalukuyang termino o suriin ang iyong cumulative GWA?`;
    }
    return `May grade record na para sa active term na ${activeYear} ${semesterLabel}, pero hindi pa rin sapat ang kabuuang passed subjects o units para tiyaking maaari ka nang mag-enroll sa Year ${nextYear}. Kailangan munang makumpirma na kumpleto at pasado ang lahat ng required subjects para sa Year ${currentYear} at natugunan ang prerequisites. Ipa-verify ang final eligibility at advising slip sa Registrar.\n\nNais mo bang suriin natin ang iyong prerequisite completion o tingnan ang inirerekomendang subjects para sa susunod na semestre?`;
  }

  if (!activeTerm) {
    return `I cannot confirm Year ${nextYear} enrollment eligibility because the active academic year and semester are not available in system settings. Please verify the current term with the Registrar.\n\nWould you like to review your current grades or completed subjects in the meantime?`;
  }
  if (!hasActiveTermGrades) {
    return `I cannot confirm Year ${nextYear} enrollment eligibility yet. Your student record lists you as Year ${currentYear}. The active term is ${activeYear} ${semesterLabel}, but no grade records are available for that term${latestTerm ? `; the latest recorded term is ${latestTerm}` : ''}. A cumulative passed-subject or unit count alone does not establish that the current year is complete. Wait for the active-semester grades to be released and encoded, then ask the Registrar to verify all required subjects and prerequisites before enrolling in the next year.\n\nWould you like to see your recommended subjects for the current term or check your cumulative GWA?`;
  }
  return `There are grade records for the active term (${activeYear} ${semesterLabel}), but a total passed-subject or unit count alone cannot confirm Year ${nextYear} enrollment eligibility. The Registrar must verify that all required Year ${currentYear} subjects are complete and that prerequisites are satisfied before confirming your next-year enrollment and advising slip.\n\nWould you like to review your prerequisite completion or view your recommended subjects for next semester?`;
}

async function getActiveAcademicTerm(supabaseClient) {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('key, value')
    .in('key', ['activeAcademicYear', 'active_academic_year', 'activeSemester', 'active_semester']);
  if (error) {
    console.warn('Could not load active academic term for chatbot:', error.message);
    return null;
  }

  const settings = new Map((data || []).map(setting => [setting.key, setting.value]));
  const academicYear = settings.get('activeAcademicYear') || settings.get('active_academic_year');
  const semester = normalizeAcademicSemester(settings.get('activeSemester') || settings.get('active_semester'));
  return academicYear && semester ? { academicYear: String(academicYear), semester } : null;
}

/**
 * Flexible student search by ID, name, or substring
 */
async function searchStudentInText(query, supabase) {
  if (!query || typeof query !== 'string') return null;

  // 0. Remove academic years (e.g. 2024-2025, 2025-2026) so they are NEVER falsely treated as student IDs
  const queryWithoutAY = query.replace(/\b(?:19|20)\d{2}-(?:19|20)\d{2}\b/g, ' ');

  // Check for ID pattern: e.g. 10526, 2023-0001, GCT-10526, 9364, 12310
  const idMatch = queryWithoutAY.match(/\b\d{4}-\d{4,5}\b/) || queryWithoutAY.match(/\b\d{4,6}\b/) || queryWithoutAY.match(/\bGCT-\d+\b/i);
  const targetId = idMatch ? idMatch[0].trim() : null;

  if (targetId) {
    const clean = targetId.replace(/^GCT-/i, '').trim();
    // 1. Direct indexed lookup in students table
    const { data: directStudents } = await supabase
      .from('students')
      .select('*')
      .or(`student_id.eq.${clean},student_id.eq.GCT-${clean},id.eq.${clean}`)
      .limit(1);
    if (directStudents && directStudents.length > 0) return directStudents[0];

    // 2. Case-insensitive / partial match in students table
    const { data: likeStudents } = await supabase
      .from('students')
      .select('*')
      .ilike('student_id', `%${clean}%`)
      .limit(1);
    if (likeStudents && likeStudents.length > 0) return likeStudents[0];

    // 3. Fallback: check historical grade records if student is present there
    const { data: grStudent } = await supabase
      .from('grade_records')
      .select('student_id, full_name, first_name, last_name, course, year_level')
      .or(`student_id.eq.${clean},student_id.eq.GCT-${clean}`)
      .limit(1);
    if (grStudent && grStudent.length > 0) {
      const g = grStudent[0];
      const gName = g.full_name || (g.first_name && g.last_name ? `${g.last_name}, ${g.first_name}` : 'Student');
      return {
        id: g.student_id,
        student_id: g.student_id,
        name: gName,
        full_name: gName,
        program: g.course || 'BSIT',
        year_level: Number(g.year_level || 1)
      };
    }

    // 4. Fallback: check academic_records if student has encoded records
    const { data: arStudent } = await supabase
      .from('academic_records')
      .select('student_id')
      .or(`student_id.eq.${clean},student_id.eq.GCT-${clean}`)
      .limit(1);
    if (arStudent && arStudent.length > 0) {
      return {
        id: arStudent[0].student_id,
        student_id: arStudent[0].student_id,
        name: `Student ${arStudent[0].student_id}`,
        full_name: `Student ${arStudent[0].student_id}`,
        program: 'BSIT',
        year_level: 1
      };
    }
  }

  // Retrieve students from database for fuzzy name matching
  const { data: studentsData } = await supabase.from('students').select('*').limit(2000);
  const students = studentsData || [];

  const lowerQuery = queryWithoutAY.toLowerCase();

  // Exclude institutional and general stop words so school name (Garcia College of Technology) never triggers false student matches
  const stopWords = new Set([
    'garcia', 'college', 'technology', 'system', 'subject', 'subjects', 'course', 'courses',
    'curriculum', 'bsit', 'bscs', 'eval', 'evaluation', 'portal', 'registrar', 'student', 'students',
    'record', 'records', 'grade', 'grades', 'assessment', 'recommendation', 'recommendations',
    'advising', 'schedule', 'enrollment', 'enroll', 'admission', 'office', 'school', 'admin', 'staff',
    'gct', 'class', 'classes', 'ano', 'ang', 'trabaho', 'dito', 'saan', 'paano', 'bakit'
  ]);

  for (const s of students) {
    const fullName = (s.name || s.full_name || '').toLowerCase().trim();
    if (!fullName) continue;

    // Full name match (e.g. "Francis Joseph Garcia" or "Tolibas, Niño")
    const cleanFull = fullName.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanFull.length >= 3 && lowerQuery.includes(cleanFull)) {
      return s;
    }

    // Match reversed name (e.g. "Niño Tolibas" when stored as "Tolibas, Niño" or vice versa)
    const nameWords = cleanFull.split(' ').filter(Boolean);
    if (nameWords.length >= 2) {
      const reversed = `${nameWords[nameWords.length - 1]} ${nameWords.slice(0, -1).join(' ')}`;
      if (lowerQuery.includes(reversed)) {
        return s;
      }
    }

    const parts = fullName
      .split(/[\s,]+/)
      .filter(p => p.length >= 3 && !['jr', 'sr', 'iii', 'ii', 'iv'].includes(p) && !stopWords.has(p));

    if (parts.length === 0) continue;

    // Strict requirement: Never match on a single first name (e.g. 'Niño' must not match another student).
    // At least 2 name components (e.g. surname + first name) must match!
    const matchedCount = parts.filter(p => new RegExp(`\\b${p}\\b`, 'i').test(lowerQuery)).length;
    if (matchedCount >= 2) {
      return s;
    }
  }

  return null;
}

/**
 * Flexible student search by ID, name, or substring, with conversation history recall
 * Recalls target student when Registrar sends broken sentences, follow-ups, or pronouns
 */
async function findTargetStudent(query, supabase, history = []) {
  // 1. Direct match on current query
  const directMatch = await searchStudentInText(query, supabase);
  if (directMatch) return directMatch;

  // 2. Check conversation history (from most recent to oldest)
  if (Array.isArray(history) && history.length > 0) {
    const recentReversed = [...history].reverse();

    // 2a. Priority 1: Check for explicitly attached student_id from prior turn's studentAction
    for (const turn of recentReversed) {
      if (turn.student_id) {
        const cleanId = String(turn.student_id).replace(/^GCT-/i, '').trim();
        const s = await searchStudentInText(cleanId, supabase);
        if (s) return s;
      }
    }

    // 2b. Priority 2: Extract explicit numeric student ID from recent turns (ignoring academic years)
    for (const turn of recentReversed) {
      const text = turn.text || turn.content || '';
      if (!text) continue;
      const cleanTurnText = text.replace(/\b(?:19|20)\d{2}-(?:19|20)\d{2}\b/g, ' ');
      const idMatch = cleanTurnText.match(/\b(?:GCT-)?(?:\d{4}-\d{4,5}|\d{4,6})\b/i);
      if (idMatch) {
        const cleanId = idMatch[0].replace(/^GCT-/i, '').trim();
        const s = await searchStudentInText(cleanId, supabase);
        if (s) return s;
      }
    }

    // 2c. Priority 3: Check combined user turns (e.g. broken continuation)
    const userTurns = history.filter(h => h && (h.sender === 'user' || h.role === 'user') && h.text);
    const lastUserTurn = userTurns[userTurns.length - 1];
    if (lastUserTurn && lastUserTurn.text && lastUserTurn.text.trim() !== query.trim()) {
      const combined = `${lastUserTurn.text} ${query}`;
      const combinedMatch = await searchStudentInText(combined, supabase);
      if (combinedMatch) return combinedMatch;
    }

    // 2d. Priority 4: Search user turns with searchStudentInText
    for (const turn of recentReversed) {
      if (turn.sender !== 'user' && turn.role !== 'user') continue;
      const text = turn.text || turn.content || '';
      if (!text) continue;
      const turnMatch = await searchStudentInText(text, supabase);
      if (turnMatch) return turnMatch;
    }
  }

  return null;
}

/**
 * Detects cohort, directory, year-level, and degree program queries
 * e.g. "by course or program", "all year level", "1st year only", "2nd", "3rd", "4th only", "BSIT students", "all records"
 */
function parseCohortFilter(query) {
  if (!query || typeof query !== 'string') {
    return { isCohortQuery: false, yearLevel: null, program: null, isGroupByProgram: false };
  }

  // 0. Remove academic year ranges (e.g. 2024-2025, 2025-2026) so they are not parsed as student IDs
  const cleanQuery = query.replace(/\b(?:19|20)\d{2}-(?:19|20)\d{2}\b/g, ' ');
  const q = cleanQuery.toLowerCase();

  // If query contains an explicit numeric student ID (4-6 digits or GCT-xxxx),
  // then this is a specific student lookup, NOT a cohort directory request
  const hasSpecificId = /\b(?:GCT-)?(?:\d{4}-\d{4,5}|\d{4,6})\b/i.test(cleanQuery);
  if (hasSpecificId) {
    return { isCohortQuery: false, yearLevel: null, program: null, isGroupByProgram: false };
  }

  // 1. Detect Year Level Filter
  const asksAllYears = /\b(all\s+year\s*levels?|all\s+years?|every\s+year\s*level|lahat\s+ng\s+year\s*levels?|lahat\s+ng\s+taon|bawat\s+taon|across\s+all\s+years?)\b/i.test(q);

  const is1st = /\b(?:1st|first|unang)\s*(?:yr|year|taon|level)\b|\b(?:year|yr|taon)\s*1\b|\b1st\s*(?:year\s*)?(?:only|lang)\b/i.test(q) ||
    (/\b1st\b/i.test(q) && !/\b1st\s*(?:sem|semester)\b/i.test(q) && /\b(?:student|students|record|records|only|lang|year|taon|level|all|course|program)\b/i.test(q));

  const is2nd = /\b(?:2nd|second|ikalawang|pangalawang)\s*(?:yr|year|taon|level)\b|\b(?:year|yr|taon)\s*2\b|\b2nd\s*(?:year\s*)?(?:only|lang)\b/i.test(q) ||
    (/\b2nd\b/i.test(q) && !/\b2nd\s*(?:sem|semester)\b/i.test(q) && /\b(?:student|students|record|records|only|lang|year|taon|level|all|course|program)\b/i.test(q));

  const is3rd = /\b(?:3rd|third|ikatlong|pangatlong)\s*(?:yr|year|taon|level)\b|\b(?:year|yr|taon)\s*3\b|\b3rd\s*(?:year\s*)?(?:only|lang)\b/i.test(q) ||
    (/\b3rd\b/i.test(q) && !/\b3rd\s*(?:sem|semester)\b/i.test(q) && /\b(?:student|students|record|records|only|lang|year|taon|level|all|course|program)\b/i.test(q));

  const is4th = /\b(?:4th|fourth|ikaapat|pang-apat)\s*(?:yr|year|taon|level)\b|\b(?:year|yr|taon)\s*4\b|\b4th\s*(?:year\s*)?(?:only|lang)\b|\bgraduating\b/i.test(q) ||
    (/\b4th\b/i.test(q) && !/\b4th\s*(?:sem|semester)\b/i.test(q) && /\b(?:student|students|record|records|only|lang|year|taon|level|all|course|program)\b/i.test(q));

  let yearLevel = null;
  const yearMatchesCount = [is1st, is2nd, is3rd, is4th].filter(Boolean).length;

  if (asksAllYears || yearMatchesCount >= 2) {
    yearLevel = 'all';
  } else if (is1st) {
    yearLevel = 1;
  } else if (is2nd) {
    yearLevel = 2;
  } else if (is3rd) {
    yearLevel = 3;
  } else if (is4th) {
    yearLevel = 4;
  }

  // 2. Detect Program / Course Filter
  let program = null;
  let isGroupByProgram = false;

  if (/\b(by\s+course|by\s+program|per\s+course|per\s+program|bawat\s+kurso|bawat\s+programa|kada\s+kurso|kada\s+programa|group(?:ed)?\s+by\s+course|group(?:ed)?\s+by\s+program|course\s+or\s+program|all\s+programs?|all\s+courses?)\b/i.test(q)) {
    isGroupByProgram = true;
  }

  if (/\b(bsit|information\s+technology)\b/i.test(q)) {
    program = 'BSIT';
  } else if (/\b(bscs|computer\s+science)\b/i.test(q)) {
    program = 'BSCS';
  } else if (/\b(bsa|accountancy)\b/i.test(q)) {
    program = 'BSA';
  } else if (/\b(bshm|hospitality(?:\s+management)?)\b/i.test(q)) {
    program = 'BSHM';
  } else if (/\b(bsba-fm|financial\s+management)\b/i.test(q)) {
    program = 'BSBA-FM';
  } else if (/\b(bsba-hrm|human\s+resource)\b/i.test(q)) {
    program = 'BSBA-HRM';
  } else if (/\b(bsba-mm|marketing\s+management)\b/i.test(q)) {
    program = 'BSBA-MM';
  } else if (/\b(bsba-om|operations?\s+management)\b/i.test(q)) {
    program = 'BSBA-OM';
  } else if (/\b(bsba|business\s+administration)\b/i.test(q)) {
    program = 'BSBA';
  } else if (/\b(bsoa|office\s+administration)\b/i.test(q)) {
    program = 'BSOA';
  } else if (/\b(bsce|civil\s+engineering)\b/i.test(q)) {
    program = 'BSCE';
  } else if (/\b(bsee|electrical\s+engineering)\b/i.test(q)) {
    program = 'BSEE';
  } else if (/\b(bsme|mechanical\s+engineering)\b/i.test(q)) {
    program = 'BSME';
  }

  // 3. Detect Cohort Intent Keywords
  const asksAllRecords = /\b(all\s+records?|lahat\s+ng\s+records?|all\s+students?|lahat\s+ng\s+estudyante|student\s+directory|masterlist|master\s+list|student\s+list|list\s+of\s+students?|roster)\b/i.test(q);
  const asksExport = /\b(excel|csv|download|export|spreadsheet)\b/i.test(q);
  const asksShow = /\b(show|display|pakita|tingnan|view|get|list|ibigay)\b/i.test(q);
  const mentionsRecordOrStudent = /\b(records?|students?|estudyante|talaan)\b/i.test(q);

  let isCohortQuery = false;
  if (asksAllYears || yearLevel !== null) {
    isCohortQuery = true;
  } else if (isGroupByProgram) {
    isCohortQuery = true;
  } else if (program !== null && (mentionsRecordOrStudent || asksShow || asksExport || asksAllRecords)) {
    isCohortQuery = true;
  } else if (asksAllRecords || (mentionsRecordOrStudent && (asksShow || asksExport))) {
    isCohortQuery = true;
  } else if (q.includes('list') || q.includes('directory') || q.includes('all student') || q.includes('export student') || q.includes('download student')) {
    isCohortQuery = true;
  }

  // 4. Detect Intent: 'grades' | 'recommendation' | 'directory'
  const isRecQuery = /\b(recommend(?:ation|ed|ing)?s?|subjects?\s+to\s+take|curriculum(?:\s+matrix|\s+catalog|\s+load)?|course\s+load|mga\s+kukunin|inirerekomenda(?:ng)?)\b/i.test(q);
  const isGradesQuery = /\b(grades?|marka|score|rating|transcript|gwa|records?\s+ng\s+marka|records?\s+ng\s+grades?)\b/i.test(q) && !isRecQuery;

  let cohortType = 'directory';
  if (isRecQuery) {
    cohortType = 'recommendation';
  } else if (isGradesQuery) {
    cohortType = 'grades';
  }

  if (isRecQuery || isGradesQuery) {
    isCohortQuery = true;
  }

  return {
    isCohortQuery,
    cohortType,
    yearLevel,
    program,
    isGroupByProgram
  };
}

/**
 * Checks whether user provided complete details (Program/Course AND Year Level) for cohort grades or recommendations
 */
function isCohortDetailsComplete(filter) {
  if (!filter || !filter.isCohortQuery) return false;
  if (filter.cohortType === 'directory') return true;

  const hasProgram = Boolean(filter.program || filter.isGroupByProgram);
  const hasYear = Boolean(filter.yearLevel !== null);

  return hasProgram && hasYear;
}

/**
 * Format curriculum recommendations as a downloadable CSV spreadsheet
 */
function generateCurriculumRecsCsv(subjects, title = 'GCT_Curriculum_Recommendations') {
  const headers = ['Subject Code', 'Description', 'Lec Units', 'Lab Units', 'Total Units', 'Year Level', 'Semester', 'Program', 'Prerequisites'];
  const rows = [headers.join(',')];

  for (const s of (subjects || [])) {
    rows.push([
      `"${s.code || ''}"`,
      `"${(s.title || '').replace(/"/g, '""')}"`,
      `"${s.lec_units || 2}"`,
      `"${s.lab_units || 1}"`,
      `"${s.units || 3}"`,
      `"${s.year_level || 1}"`,
      `"${s.semester || 1}"`,
      `"${s.program || 'BSIT'}"`,
      `"${(s.prerequisites_text || s.prerequisites || 'None').replace(/"/g, '""')}"`
    ].join(','));
  }

  return rows.join('\r\n');
}

/**
 * Parse a raw name string into separate Last Name, First Name, and Display Name
 */
function parseNameParts(rawName) {
  let lName = '';
  let fName = '';
  let dispName = String(rawName || '').trim();
  if (dispName && dispName.includes(',')) {
    const parts = dispName.split(',');
    lName = parts[0].trim().toUpperCase();
    fName = parts.slice(1).join(',').trim().toUpperCase();
    dispName = `${lName}, ${fName}`.trim();
  } else if (dispName) {
    const parts = dispName.split(/\s+/);
    if (parts.length > 1) {
      lName = parts[parts.length - 1].toUpperCase();
      fName = parts.slice(0, -1).join(' ').toUpperCase();
    } else {
      lName = dispName.toUpperCase();
      fName = dispName.toUpperCase();
    }
  }
  return { lastName: lName, firstName: fName, displayName: dispName };
}

/**
 * Format complete institutional grade records matching exportCompleteAllGradesExcel / exportCompleteAllGradesCsv
 * Official Garcia College of Technology format:
 * - Row 1: ALL GRADES
 * - Row 2: Complete Grade Record
 * - Row 3: Blank spacer
 * - Row 4 Headers: Student ID, Last Name, First Name, Name, Course, Year Level, Semester, Academic Year, Subject, Grade, Units
 * - Grades strictly formatted to 2 decimals ('1.00', '1.25', '1.50', '2.00', '3.00', '5.00')
 */
function generateCohortGradesCsv(gradeRows, title = 'GCT_ALL_GRADES_Complete_Record') {
  const lines = [
    '"ALL GRADES"',
    '"Complete Grade Record"',
    '""',
    '"Student ID","Last Name","First Name","Name","Course","Year Level","Semester","Academic Year","Subject","Grade","Units"'
  ];

  for (const r of (gradeRows || [])) {
    let formattedGrade = '';
    if (r.grade !== null && r.grade !== undefined && r.grade !== '') {
      const num = parseFloat(String(r.grade));
      if (!isNaN(num)) {
        formattedGrade = num.toFixed(2);
      } else {
        formattedGrade = String(r.grade).trim();
      }
    }

    const sid = String(r.student_id || r.studentId || '').trim();
    let lastName = String(r.last_name || r.lastName || '').trim();
    let firstName = String(r.first_name || r.firstName || '').trim();
    let fullName = String(r.full_name || r.name || '').trim();

    if ((!lastName || !firstName) && fullName) {
      const parsed = parseNameParts(fullName);
      if (!lastName) lastName = parsed.lastName;
      if (!firstName) firstName = parsed.firstName;
    }
    if (!fullName && (lastName || firstName)) {
      fullName = `${lastName}, ${firstName}`.trim();
    }
    lastName = lastName.toUpperCase();
    firstName = firstName.toUpperCase();
    fullName = fullName.toUpperCase();

    const course = String(r.course || r.program || 'BSIT').trim().toUpperCase();
    const yearLevel = Number(r.year_level || r.yearLevel || r.year) || 1;

    let semStr = 'First';
    const rawSem = String(r.semester || r.semester_name || r.term || '').toLowerCase();
    if (rawSem.includes('summer') || rawSem === '3') {
      semStr = 'Summer';
    } else if (rawSem.includes('2') || rawSem.includes('second')) {
      semStr = 'Second';
    } else {
      semStr = 'First';
    }

    const academicYear = String(r.academic_year || r.academicYear || (r.term && r.term.match(/\d{4}-\d{4}/)?.[0]) || '2025-2026').trim();
    const subject = String(r.subject || r.subject_code || r.code || 'N/A').trim();
    const units = Number(r.units) || 3;

    lines.push([
      `"${sid.replace(/"/g, '""')}"`,
      `"${lastName.replace(/"/g, '""')}"`,
      `"${firstName.replace(/"/g, '""')}"`,
      `"${fullName.replace(/"/g, '""')}"`,
      `"${course.replace(/"/g, '""')}"`,
      yearLevel,
      `"${semStr.replace(/"/g, '""')}"`,
      `"${academicYear.replace(/"/g, '""')}"`,
      `"${subject.replace(/"/g, '""')}"`,
      `"${formattedGrade}"`,
      units
    ].join(','));
  }

  return lines.join('\r\n');
}

/**
 * Build Markdown table for curriculum subject recommendations
 */
function buildCurriculumTableMarkdown(subjects, max = 20) {
  const display = (subjects || []).slice(0, max);
  if (display.length === 0) {
    return [
      '| Subject Code | Description | Units | Year Level | Semester | Prerequisites |',
      '| :--- | :--- | :---: | :---: | :---: | :--- |',
      '| — | No curriculum subjects found | — | — | — | — |'
    ].join('\n');
  }

  const rows = display.map(s => {
    const code = s.code || 'N/A';
    const title = String(s.title || '').replace(/\|/g, '-').trim();
    const units = s.units || 3;
    const yl = s.year_level || 1;
    const sem = s.semester || 1;
    const prereq = s.prerequisites_text || s.prerequisites || 'None';
    return `| \`${code}\` | **${title}** | ${units} | Year ${yl} | Sem ${sem} | ${prereq} |`;
  });

  return [
    '| Subject Code | Description | Units | Year Level | Semester | Prerequisites |',
    '| :--- | :--- | :---: | :---: | :---: | :--- |',
    ...rows
  ].join('\n');
}

/**
 * Build Markdown table for student grade summaries in cohort
 */
function buildCohortGradesSummaryTableMarkdown(studentSummaries, max = 20) {
  const display = (studentSummaries || []).slice(0, max);
  if (display.length === 0) {
    return [
      '| Student ID | Full Name | Program | Year Level | GWA | Passed Units | Deficiencies | Standing |',
      '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |',
      '| — | No grade records found | — | — | — | — | — | — |'
    ].join('\n');
  }

  const rows = display.map(s => {
    const id = s.student_id || s.id || 'N/A';
    const name = String(s.full_name || s.name || 'Student').replace(/\|/g, '-').trim();
    const prog = s.program || 'BSIT';
    const yl = s.year_level || 1;
    const gwa = s.gwa || 'N/A';
    const passed = s.passedUnits || 0;
    const failed = s.failedCount || 0;
    const standing = failed > 0 ? `${failed} deficiency` : 'Regular';
    return `| \`${id}\` | **${name}** | ${prog} | Year ${yl} | **${gwa}** | ${passed} | ${failed} | ${standing} |`;
  });

  return [
    '| Student ID | Full Name | Program | Year Level | GWA | Passed Units | Deficiencies | Standing |',
    '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |',
    ...rows
  ].join('\n');
}

/**
 * Detects and retrieves multiple target students mentioned in a single query
 * e.g. "student id 1111,2222,3333 show me their record"
 */
async function findMultipleTargetStudents(query, supabase) {
  if (!query || typeof query !== 'string') return [];

  // 1. Strip academic year ranges (e.g. 2024-2025, 2025-2026) so they aren't parsed as IDs
  const cleanQuery = query.replace(/\b(?:19|20)\d{2}-(?:19|20)\d{2}\b/g, ' ');

  // 2. Extract all potential numeric student IDs (4 to 6 digits, or GCT-xxxx, or 2023-xxxx)
  const matches = Array.from(cleanQuery.matchAll(/\b(?:GCT-)?(?:\d{4}-\d{4,5}|\d{4,6})\b/gi)).map(m => m[0].trim());
  const uniqueIds = Array.from(new Set(matches.map(id => id.replace(/^GCT-/i, '').trim())));

  const matchedStudents = [];
  const foundStudentIds = new Set();

  for (const cleanId of uniqueIds) {
    // 1. Lookup in students table
    const { data: directStudents } = await supabase
      .from('students')
      .select('*')
      .or(`student_id.eq.${cleanId},student_id.eq.GCT-${cleanId},id.eq.${cleanId}`)
      .limit(1);

    if (directStudents && directStudents.length > 0) {
      const s = directStudents[0];
      const sId = String(s.student_id || s.id);
      if (!foundStudentIds.has(sId)) {
        foundStudentIds.add(sId);
        matchedStudents.push(s);
      }
      continue;
    }

    // 2. Partial / ilike lookup
    const { data: likeStudents } = await supabase
      .from('students')
      .select('*')
      .ilike('student_id', `%${cleanId}%`)
      .limit(1);

    if (likeStudents && likeStudents.length > 0) {
      const s = likeStudents[0];
      const sId = String(s.student_id || s.id);
      if (!foundStudentIds.has(sId)) {
        foundStudentIds.add(sId);
        matchedStudents.push(s);
      }
      continue;
    }

    // 3. Fallback: check historical grade records
    const { data: grStudent } = await supabase
      .from('grade_records')
      .select('student_id, full_name, first_name, last_name, course, year_level')
      .or(`student_id.eq.${cleanId},student_id.eq.GCT-${cleanId}`)
      .limit(1);

    if (grStudent && grStudent.length > 0) {
      const g = grStudent[0];
      const gName = g.full_name || (g.first_name && g.last_name ? `${g.last_name}, ${g.first_name}` : `Student ${g.student_id}`);
      if (!foundStudentIds.has(g.student_id)) {
        foundStudentIds.add(g.student_id);
        matchedStudents.push({
          id: g.student_id,
          student_id: g.student_id,
          name: gName,
          full_name: gName,
          program: g.course || 'BSIT',
          year_level: Number(g.year_level || 1)
        });
      }
      continue;
    }
  }

  // 3. If fewer than 2 students found by ID, also check for multiple student names
  if (matchedStudents.length < 2) {
    const { data: allStudents } = await supabase.from('students').select('*').limit(2000);
    if (allStudents && allStudents.length > 0) {
      const lowerQuery = query.toLowerCase();
      for (const s of allStudents) {
        const fullName = (s.name || s.full_name || '').toLowerCase().trim();
        if (!fullName || fullName.length < 4) continue;
        const sId = String(s.student_id || s.id);
        if (foundStudentIds.has(sId)) continue;

        const cleanFull = fullName.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanFull.length >= 4 && lowerQuery.includes(cleanFull)) {
          foundStudentIds.add(sId);
          matchedStudents.push(s);
        }
      }
    }
  }

  return matchedStudents;
}

/**
 * Fetch a student's grades and recommendations (from both grade_records and academic_records)
 */
async function getStudentRecordsAndRecs(student, supabase) {
  const cleanId = String(student.student_id || student.id || '').replace(/^GCT-/i, '').replace(/^student-/i, '').replace(/^acc-/i, '').trim();
  const idVariants = Array.from(new Set([
    student.id,
    student.student_id,
    cleanId,
    `GCT-${cleanId}`
  ])).filter(Boolean);

  const orClause = idVariants.map(id => `student_id.eq.${id}`).join(',');

  // 1. Fetch subjects table to build code/id lookup
  const { data: subsData } = await supabase.from('subjects').select('*');
  const subjectsMap = new Map();
  const codeMap = new Map();
  (subsData || []).forEach(s => {
    subjectsMap.set(s.id, s);
    if (s.code) {
      codeMap.set(s.code.toLowerCase().trim(), s);
      const norm = normalizeSubjCode(s.code);
      codeMap.set(norm, s);
    }
    if (s.title) {
      codeMap.set(s.title.toLowerCase().trim(), s);
      const titleNorm = normalizeSubjCode(s.title);
      codeMap.set(titleNorm, s);
    }
  });

  // 2. Query grade_records (historical Excel registrar import)
  const { data: gRows } = await supabase
    .from('grade_records')
    .select('*')
    .in('student_id', idVariants)
    .order('academic_year', { ascending: true })
    .order('semester', { ascending: true });

  // 3. Query academic_records (manual entries)
  let aRows = [];
  try {
    const aQuery = supabase.from('academic_records').select('*');
    if (orClause && typeof aQuery.or === 'function') {
      const { data } = await aQuery.or(orClause);
      aRows = data || [];
    } else {
      const { data } = await aQuery;
      aRows = data || [];
    }
  } catch (e) {
    aRows = [];
  }

  const mergedMap = new Map();

  // Process historical grade_records first
  (gRows || []).forEach(g => {
    const subjRaw = (g.subject || '').trim();
    const subjClean = subjRaw.replace(/\s+/g, ' ');
    const subNorm = normalizeSubjCode(subjClean);
    const matchedSub = codeMap.get(subjClean.toLowerCase()) || codeMap.get(subNorm) || null;

    const isSummer = String(g.semester).toLowerCase().includes('summer') || g.semester === '3' || g.semester === 3;
    const isSem2 = !isSummer && (g.semester === 'Second' || g.semester === '2' || String(g.semester).toLowerCase().includes('2nd'));
    const semFormatted = isSummer ? 'Summer' : (isSem2 ? '2nd Sem' : '1st Sem');
    const termFormatted = `${g.academic_year || '2023-2024'} ${semFormatted}`;

    const rawGradeStr = String(g.raw_grade || '').trim();
    const rawNum = parseFloat(rawGradeStr);
    const isDropped = rawGradeStr === '9' || g.grade === 9 || rawGradeStr.toUpperCase() === 'DRP' || (g.needs_review && rawGradeStr === '9');
    const isZero = g.grade === 0 || Number(g.grade) === 0 || rawGradeStr === '0' || rawGradeStr === '0.0' || rawGradeStr === '0.00';
    const isExplicitFailed = isZero || rawGradeStr === '5' || rawGradeStr === '5.0' || rawGradeStr === '5.00' || g.grade === 5 || (g.grade !== null && Number(g.grade) > 3.0 && !isDropped) || (g.needs_review && (rawGradeStr === '0.75' || rawNum < 1.0));

    let status = 'failed';
    let cleanGrade = null;

    if (isDropped) {
      status = 'dropped';
      cleanGrade = null;
    } else if (isExplicitFailed) {
      status = 'failed';
      cleanGrade = 5.0;
    } else if (g.grade !== null && g.grade !== undefined && g.grade !== '') {
      const num = Number(g.grade);
      if (!isNaN(num)) {
        if (num >= 1.0 && num <= 3.0) {
          cleanGrade = num;
          status = 'passed';
        } else {
          cleanGrade = num > 3.0 ? num : 5.0;
          status = 'failed';
        }
      } else {
        cleanGrade = 5.0;
        status = 'failed';
      }
    } else if (rawGradeStr && !isNaN(rawNum)) {
      if (rawNum >= 1.0 && rawNum <= 3.0) {
        cleanGrade = rawNum;
        status = 'passed';
      } else {
        cleanGrade = 5.0;
        status = 'failed';
      }
    } else {
      status = 'failed';
      cleanGrade = 5.0;
    }

    const recYearLevel = Number(g.year_level) || Number(matchedSub?.year_level) || 1;

    const recordKey = `${subNorm}-${termFormatted}`;
    const newEntry = {
      code: matchedSub?.code || subjClean,
      title: matchedSub?.title || g.subject_title || subjClean,
      units: Number(matchedSub?.units || g.units || 3),
      grade: cleanGrade,
      status,
      term: termFormatted,
      semester: isSummer ? 'summer' : (isSem2 ? '2' : '1'),
      academic_year: g.academic_year || '2023-2024',
      is_dropped: isDropped,
      year_level: recYearLevel,
      curriculum_year_level: Number(matchedSub?.year_level) || recYearLevel,
      enrolled_year_level: Number(g.year_level) || recYearLevel
    };

    if (mergedMap.has(recordKey)) {
      const existing = mergedMap.get(recordKey);
      const existPass = existing.status === 'passed';
      const newPass = status === 'passed';
      if (newPass && !existPass) {
        mergedMap.set(recordKey, newEntry);
      }
    } else {
      mergedMap.set(recordKey, newEntry);
    }
  });

  // Overlay manual academic_records (take precedence if present)
  (aRows || []).forEach(r => {
    const s = subjectsMap.get(r.subject_id) || codeMap.get((r.subject_id || '').toLowerCase().trim());
    const subNorm = (s?.code || r.subject_id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const termFormatted = r.term || 'Academic Record';
    const recordKey = `${subNorm}-${termFormatted}`;

    const isASummer = String(r.semester || r.term || '').toLowerCase().includes('summer');
    const isASem2 = !isASummer && (String(r.semester || r.term || '').toLowerCase().includes('2nd') || String(r.semester || r.term || '').toLowerCase().includes('second') || String(r.semester) === '2');
    const aSem = isASummer ? 'summer' : (isASem2 ? '2' : '1');

    const recYearLevel = Number(r.year_level || s?.year_level || 1);
    const aGradeNum = (r.grade !== null && r.grade !== undefined && !isNaN(Number(r.grade))) ? Number(r.grade) : null;
    const aStatus = r.status || (aGradeNum !== null && aGradeNum >= 1.0 && aGradeNum <= 3.0 ? 'passed' : 'failed');
    const aFinalGrade = aStatus === 'passed' ? aGradeNum : (aGradeNum !== null && aGradeNum > 3.0 ? aGradeNum : 5.0);

    mergedMap.set(recordKey, {
      code: s?.code || r.subject_id || 'SUBJ',
      title: s?.title || r.subject_title || 'Curriculum Subject',
      units: Number(s?.units || r.units || 3),
      grade: aFinalGrade,
      status: aStatus,
      term: termFormatted,
      semester: aSem,
      academic_year: r.academic_year || '',
      is_dropped: aStatus === 'dropped',
      year_level: recYearLevel,
      curriculum_year_level: Number(s?.year_level) || recYearLevel,
      enrolled_year_level: Number(r.year_level) || recYearLevel
    });
  });

  const records = Array.from(mergedMap.values());

  // 4. Query recommendations
  let recsData = [];
  try {
    const recsQuery = supabase.from('recommendations').select('*');
    if (orClause && typeof recsQuery.or === 'function') {
      const { data } = await recsQuery.or(orClause);
      recsData = data || [];
    } else {
      const { data } = await recsQuery;
      recsData = data || [];
    }
  } catch (e) {
    recsData = [];
  }

  return { records, recommendations: recsData || [] };
}

/**
 * Ensures that any generated response terminates with a relevant follow-up question.
 * If the response does not end with a question mark (?), this helper appends a contextually
 * appropriate follow-up question based on role, intent, language, and student info.
 */
function ensureFollowUpQuestion(text, context = {}) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();

  // Check if the response already ends with a question mark (allowing trailing markdown/quotes/whitespace)
  const endsWithQuestion = /\?\s*(\*{1,2}|_{1,2}|`|"|'|\))*$/m.test(trimmed);
  // Also check if the last 180 characters contain a question mark
  const lastChunk = trimmed.slice(-180);
  const hasRecentQuestion = /\?[^.!?\n]*$/m.test(lastChunk);

  if (endsWithQuestion || hasRecentQuestion) {
    return trimmed;
  }

  const { role, intent, userIsTagalog, studentId } = context;

  let followUp = '';

  if (role === 'guest') {
    followUp = userIsTagalog
      ? 'Nais mo ba ng karagdagang impormasyon ukol sa admission requirements, mga programa, o paano gumawa ng student account?'
      : 'Would you like more details regarding admission requirements, degree programs, or how to create a student account?';
  } else if (role === 'student') {
    if (intent === 'grades') {
      followUp = userIsTagalog
        ? 'Nais mo bang suriin natin ang iyong overall standing at kalkulahin ang iyong mga inirerekomendang asignatura para sa susunod na semestre?'
        : 'Would you like me to evaluate your overall standing and show your recommended subjects for next semester?';
    } else if (intent === 'recommendation') {
      followUp = userIsTagalog
        ? 'Nais mo bang suriin ang mga prerequisite para sa mga inirerekomendang asignaturang ito, o tingnan ang iyong active deficiencies?'
        : 'Would you like to review the specific prerequisite requirements for these recommended subjects, or check your active deficiencies?';
    } else if (intent === 'comprehensive') {
      followUp = userIsTagalog
        ? 'Nais mo bang suriin ang mga prerequisite para sa mga darating na asignatura, o i-download ang iyong opisyal na ulat sa Excel?'
        : 'Would you like to explore specific prerequisite dependencies for these upcoming subjects, or download your complete academic evaluation in Excel?';
    } else {
      followUp = userIsTagalog
        ? 'Nais mo bang tingnan ang iyong pinakahuling marka, alamin ang inirerekomendang subjects para sa susunod na semestre, o kalkulahin ang iyong cumulative GWA?'
        : 'Would you like to review your latest grades, check your recommended subjects for next semester, or calculate your cumulative GWA?';
    }
  } else {
    // Registrar admin / staff:
    // "stay mo padin yung may mag follow up na question pag di details ang hiningi or inano ng user"
    // If user already requested full details (such as comprehensive assessment), do not append redundant follow-up.
    if (intent === 'comprehensive') {
      return trimmed;
    }

    const idLabel = studentId ? `para kay ${studentId}` : '';
    const idLabelEn = studentId ? `for ${studentId}` : '';

    if (intent === 'grades') {
      followUp = userIsTagalog
        ? `Nais mo bang kalkulahin ang mga inirerekomendang asignatura ${idLabel} para sa susunod na termino, o suriin ang graduation eligibility?`
        : `Would you like me to compute recommended subjects ${idLabelEn} for the upcoming term, or evaluate graduation prerequisite standing?`;
    } else if (intent === 'recommendation') {
      followUp = userIsTagalog
        ? `Nais mo bang suriin ang buong talaan ng nakaraang marka ${idLabel}, o buksan ang profile sa Subject Recommendations?`
        : `Would you like to inspect this student's full historical grade sheet ${idLabelEn}, or open their profile in Subject Recommendations?`;
    } else {
      followUp = userIsTagalog
        ? 'Aling Student ID o katanungang pang-operasyon ang nais mong simulan natin ngayon?'
        : 'Which student ID or operational inquiry would you like to begin with today?';
    }
  }

  return `${trimmed}\n\n${followUp}`;
}

/**
 * Returns a list of 2-4 contextual follow-up questions for the UI quick action chips
 */
function generateFollowUpQuestions(options = {}) {
  const { role, intent, userIsTagalog, studentId, cleanId } = options;
  const sId = cleanId || studentId;

  if (role === 'guest') {
    return userIsTagalog
      ? [
          'Ano ang admission requirements para sa bagong estudyante?',
          'Maaari bang ma-credit ang nakaraang subjects ng transferees?',
          'Paano makikipag-ugnayan sa GCT College Registrar?',
          'Paano gumawa ng student account?'
        ]
      : [
          'Admission requirements for new students',
          'Can transferees have previous subjects credited?',
          'How can I contact the GCT College Registrar?',
          'How do I create a student account?'
        ];
  }

  if (role === 'student') {
    if (intent === 'grades') {
      return userIsTagalog
        ? [
            'Anong mga asignatura ang pwede kong kunin sa susunod na semestre?',
            'Ano ang aking cumulative GWA at academic standing?',
            'I-download ang aking academic record sa Excel'
          ]
        : [
            'What subjects am I eligible for next semester?',
            'What is my cumulative GWA and standing?',
            'Download my official academic record'
          ];
    }
    if (intent === 'recommendation') {
      return userIsTagalog
        ? [
            'Ipakita ang aking buong talaan ng marka',
            'Ano ang aking mga bagsak o active deficiencies?',
            'I-download ang aking advising slip'
          ]
        : [
            'Show my complete grade sheet across all terms',
            'What are my active prerequisite deficiencies?',
            'Download my official academic record'
          ];
    }
    return userIsTagalog
      ? [
          'Ano ang aking cumulative GWA at academic standing?',
          'Anong mga asignatura ang pwede kong kunin sa susunod na semestre?',
          'I-download ang aking academic record sa Excel'
        ]
      : [
          'What is my cumulative GWA and standing?',
          'What subjects am I eligible for next semester?',
          'Download my official academic record'
        ];
  }

  // Registrar / Staff: Return empty array to disable FAQ / suggested follow-up chips for admin & staff
  return [];
}

async function queryChatbot(req, res, customSupabase = null) {
  // When Express invokes this route handler, the 3rd argument is `next` (a middleware function).
  // Only treat customSupabase as a client if it has a `.from` function (e.g. mock in unit tests).
  const db = (customSupabase && typeof customSupabase.from === 'function') ? customSupabase : supabase;
  try {
    const { query, history } = req.body;

    // Format conversation history for multi-turn context recall and continuity
    const formattedHistory = Array.isArray(history) && history.length > 0
      ? history
        .filter(h => h && h.text && typeof h.text === 'string')
        .slice(-8)
        .map(h => `${(h.sender === 'user' || h.role === 'user') ? 'User' : 'Assistant'}: ${h.text.replace(/\n+/g, ' ').trim()}`)
        .join('\n')
      : '';
    if (!query) {
      return res.status(400).json({ error: 'Query text is required' });
    }

    const userId = req.user?.id || 'guest';
    const userName = req.user?.full_name || (req.user?.role === 'student' ? 'Student' : (req.user?.role ? 'Registrar Staff' : 'Guest'));
    const userRole = req.user?.role || 'guest';
    const userIsTagalog = isTagalogQuery(query);

    // 0. OUT-OF-SCOPE GUARDRAIL
    // If query is unrelated to GCT, student academic records, curriculum, or enrollment,
    // politely apologize and explain the assistant's dedicated scope.
    if (isOutOfScopeQuery(query)) {
      const apologyResponse = stripEmojis(generateOutOfScopeResponse(query));
      return res.json({
        id: 'chat-' + Date.now(),
        query,
        response: apologyResponse,
        role: userRole,
        timestamp: new Date().toISOString(),
        file_export: null,
        student_action: null,
        follow_up_questions: generateFollowUpQuestions({ role: userRole, userIsTagalog })
      });
    }

    let systemPrompt = '';
    let assistantResponse = '';
    let fileExport = null;
    let studentAction = null;

    // =========================================================================
    // 1. GUEST / UNLOGGED-IN USER CHATBOT LOGIC
    // Strict requirement: No student records, grades, or personal info allowed!
    // Must login first to access any student-specific information.
    // =========================================================================
    const faqMatch = matchGctFaq(query, userIsTagalog);

    if (userRole === 'guest') {
      if (faqMatch) {
        assistantResponse = faqMatch;
        systemPrompt = '';
      } else {
        const isRegistrationOrPublic = /\b(create account|create student account|how to register|register|sign up|signup|how to apply|apply|programs|program|course|courses|offer|admissions|admission|office hours|campus|location|contact|registrar office|faq|faqs)\b/i.test(query);

        const isConfidentialStudentQuery = /\b(grade|grades|gwa|record|records|transcript|passed|failed|fail|retake|prereq|prerequisite|eval|evaluation|standing|who is|status of|profile of|user list|students list|password|passwords)\b/i.test(query) || (/\b\d{4,6}\b/.test(query) && !isRegistrationOrPublic);

        if (isConfidentialStudentQuery && !isRegistrationOrPublic) {
          assistantResponse = userIsTagalog
            ? `**Limitadong Akses — Kailangang Mag-login**\n\nAng academic records, grades, curriculum evaluations, at subject recommendations ng mga mag-aaral ay mahigpit na kumpidensyal.\n\n**Hindi maaaring tingnan ang impormasyon ng estudyante nang hindi naka-login.**\n\nPakisuyong **mag-log in** gamit ang inyong opisyal na GCT account (Estudyante, Registrar Staff, o Administrator) upang tingnan ang academic records.\n\n*Kung wala ka pang account, i-click ang "Create Student Account" sa login screen upang magparehistro.*`
            : `**Access Restricted — Login Required**\n\nStudent academic records, grades, curriculum evaluations, and subject recommendations are strictly confidential.\n\n**No student information can be accessed without logging in.**\n\nPlease **log in** with your official GCT account (Student, Registrar Staff, or Administrator) to view academic records.\n\n*If you do not have an account yet, click "Create Student Account" on the login screen to register.*\n\nWould you like guidance on creating your student account, or information on general admission requirements?`;
          systemPrompt = '';
        } else {
          const q = query.toLowerCase();
          if (q.includes('register') || q.includes('create') || q.includes('sign up') || q.includes('apply')) {
            assistantResponse = userIsTagalog
              ? `Upang magparehistro para sa GCT Student Portal account:\n1. I-click ang "**Create Student Account**" sa login page.\n2. Punan ang form ng iyong GCT Student ID Number, Pangalan, Kurso (BSIT, BSCS, BSA, BSBA, BSHM, BSCE, atbp.), at Gmail address.\n3. I-verify ang 6-digit OTP code na ipapadala sa iyong Gmail at i-submit.\n4. Kapag na-verify na ng Registrar Staff ang iyong credentials, ia-activate ang iyong account!\n\nNais mo bang malaman ang mga kinakailangang dokumento para sa admission bago magparehistro?`
              : `To register for a GCT Student Portal account:\n1. Click "**Create Student Account**" on the login page.\n2. Complete the form with your GCT Student ID Number, Full Name, Academic Program (BSIT, BSCS, BSA, BSBA, BSHM, BSCE, etc.), and Gmail address.\n3. Verify the 6-digit OTP code sent to your Gmail and submit.\n4. Once Registrar Staff verifies your credentials, your account will be activated!\n\nWould you like guidance on the required admission credentials needed before registration?`;
          } else if (q.includes('program') || q.includes('course') || q.includes('offer') || q.includes('bsit') || q.includes('curriculum')) {
            assistantResponse = userIsTagalog
              ? `Ang Garcia College of Technology ay nag-aalok ng mga kursong BSIT (Information Technology), BSCS (Computer Science), BSA (Accountancy), BSBA (Business Administration), BSHM (Hospitality Management), BSOA (Office Administration), BSCE (Civil Engineering), BSEE (Electrical Engineering), at BSME (Mechanical Engineering) na may automated prerequisite tracking at AI-based subject advising.\n\n*Upang makita ang sariling curriculum matrices at grade sheets, pakisuyong mag-log in muna.*\n\nNais mo bang makita ang admission requirements para sa alinman sa mga programang ito?`
              : `Garcia College of Technology offers degree programs including BSIT (Information Technology), BSCS (Computer Science), BSA (Accountancy), BSBA (Business Administration), BSHM (Hospitality Management), BSOA (Office Administration), BSCE (Civil Engineering), BSEE (Electrical Engineering), and BSME (Mechanical Engineering) with automated prerequisite tracking and AI-based subject advising.\n\n*To view individual curriculum matrices and grade sheets, please log in.*\n\nWould you like to see the admission requirements for any of these degree programs?`;
          } else if (q.includes('pending') || q.includes('approval') || q.includes('wait')) {
            assistantResponse = userIsTagalog
              ? `Kung ang iyong account registration ay kasalukuyang pending approval, bineberipika pa ng Registrar Staff ang iyong student records. Pinoproseso ang mga accounts tuwing office hours (Lunes hanggang Biyernes, 8:00 AM – 5:00 PM).\n\nNais mo ba ang mga detalye sa pakikipag-ugnayan sa Registrar's Office upang masundan ang katayuan ng iyong account?`
              : `If your account registration is pending approval, Registrar Staff are currently verifying your student records. Accounts are processed during office hours (Mon–Fri, 8:00 AM – 5:00 PM).\n\nWould you like the contact information of the Registrar's Office to follow up on your account status?`;
          } else if (q.includes('contact') || q.includes('office') || q.includes('location') || q.includes('help')) {
            assistantResponse = userIsTagalog
              ? `Maaari mong bisitahin ang GCT Registrar's Office sa campus (Lunes hanggang Biyernes, 8:00 AM – 5:00 PM) para sa direktang tulong sa enrollment at student ID verification.\n\nNais mo ba ng impormasyon ukol sa mga kinakailangan sa admission o mga iniaalok na programa sa GCT?`
              : `You can visit the GCT Registrar's Office on campus (Monday to Friday, 8:00 AM – 5:00 PM) for direct enrollment assistance and student ID verification.\n\nWould you like information on admission requirements or degree programs offered at GCT?`;
          } else {
            assistantResponse = userIsTagalog
              ? `Maligayang pagdating sa Garcia College of Technology!\n\nAko ang iyong GCT AI Assistant. Bilang bisita, masasagot ko ang mga pangkalahatang katanungan ukol sa pagpaparehistro ng estudyante, degree programs, at mga hakbang sa enrollment.\n\n*Tandaan: Para sa mga rekord ng estudyante, marka, at subject recommendations, pakisuyong mag-log in muna.*\n\nAno ang nais mong malaman ngayon tungkol sa mga programa, enrollment, o admissions ng GCT?`
              : `Welcome to Garcia College of Technology!\n\nI am your GCT AI Assistant. As an unauthenticated visitor, I can answer general questions about student registration, degree programs, and enrollment steps.\n\n*Note: For student records, grades, and subject recommendations, please log in first.*\n\nWhat would you like to know today regarding GCT programs, enrollment, or admission requirements?`;
          }

          systemPrompt = `You are the GCT AI Admissions & Inquiries Assistant for Garcia College of Technology.
User status: Unauthenticated Visitor / Guest.

Institutional Context:
- Institution: Garcia College of Technology (GCT)
- Degree Programs: Bachelor of Science in Information Technology (BSIT), Computer Science (BSCS).
- Account Registration: Visitors can click "Create Student Account" on the login screen to sign up. Registrations are reviewed and activated by Registrar Staff during office hours (Mon-Fri, 8:00 AM - 5:00 PM).
- Privacy Rule: You CANNOT disclose individual student grades, personal IDs, passwords, or individual records to unauthenticated visitors. Tell them to log in.

PRIMARY LANGUAGE DIRECTIVE:
- Your PRIMARY and DEFAULT language is ENGLISH. Always communicate in professional, clear English by default.
- MANDATORY EXCEPTION: If the user communicates in Tagalog or Taglish, you MUST reply in fluent, natural, polite Tagalog/Taglish.
- STRICT ZERO EMOJIS RULE: Under no circumstances should you include emojis or decorative smiley symbols. Keep the reply clean and elegant.
- SCOPE RESTRICTION: You are STRICTLY an assistant for GCT admissions, programs, and registration. If the user asks about anything unrelated (such as weather, sports, general trivia, cooking, or general news), politely apologize and state that it is outside your scope because you are solely for the GCT Subject Assessment and Recommendation System.

MANDATORY FOLLOW-UP QUESTION DIRECTIVE:
- Every answer to a user message, question, or inquiry MUST conclude with a relevant, proactive follow-up question.
- Guide the user to the next logical step (e.g. asking if they want admission requirements, instructions on registering an account, or contact details for the Registrar).
- NEVER end your reply without a follow-up question.

RECENT CONVERSATION HISTORY (FOR MULTI-TURN RECALL & CONTINUITY):
${formattedHistory || 'No previous messages in this session.'}

CONVERSATION CONTINUITY & RECALL DIRECTIVE:
- When the Registrar sends a message that continues a prior thought, was sent before finishing typing, or uses pronouns/follow-ups (e.g. "kanya", "ito", "pala", "ano pa", "next semester"), RECALL the recent context above and seamlessly respond with full awareness of the conversation.

USER MESSAGE: "${query}"

Instructions:
- Directly, politely, and helpfully reply to the user's message.
- Answer in the same language as the user (English default; Tagalog/Taglish if user spoke Tagalog).
- Conclude with an engaging, helpful follow-up question.`;
        }
      }
    }

    // =========================================================================
    // 2. STUDENT ROLE CHATBOT LOGIC
    // Strict requirement: Only data of the logged-in student is provided.
    // Prohibited from querying or accessing records of other students!
    // =========================================================================
    else if (userRole === 'student') {
      const ownStudentId = String(req.user.student_id || req.user.username || '').replace(/^GCT-/i, '').trim();

      if (faqMatch) {
        assistantResponse = faqMatch;
        systemPrompt = '';
      } else {

        // Check if student is attempting to query another student ID or other students
        const idMatches = query.match(/\b\d{4}-\d{4,5}\b/g) || query.match(/\b\d{4,6}\b/g) || query.match(/\bGCT-\d+\b/gi);
        const isAskingOtherStudentId = idMatches && idMatches.some(id => {
          const clean = id.replace(/^GCT-/i, '').trim();
          return clean.toLowerCase() !== ownStudentId.toLowerCase();
        });

        const isAskingOtherStudents = isAskingOtherStudentId ||
          /\b(other student|other students|classmate|classmates|everyone|all students|list students|grades of another|who failed)\b/i.test(query);

        if (isAskingOtherStudents) {
          assistantResponse = `**Access Denied — Privacy Protection**

You are currently logged in as **${userName}** (ID: \`${ownStudentId || req.user.username}\`).

Under GCT Data Privacy policies, students are **strictly authorized to access only their own academic records and subject recommendations**. You cannot view, search, or query information about other students.`;
        } else {
          // Fetch logged-in student's information
          const { data: students } = await db
            .from('students')
            .select('*')
            .or(`id.eq.${userId},student_id.eq.${ownStudentId},student_id.eq.GCT-${ownStudentId}`)
            .limit(1);

          const studentInfo = students?.[0] || {
            id: userId || 'student',
            student_id: ownStudentId || req.user.username || 'Student',
            name: userName,
            program: 'BSIT',
            year_level: 1,
            section: 'A',
            schedule: 'Schedule 1'
          };

          if (isStudentGreetingQuery(query)) {
            studentIntent = 'greeting';
            fileExport = null;
            studentAction = {
              student_id: studentInfo.student_id,
              student_name: userName,
              program: studentInfo.program,
              intent: 'greeting'
            };
            assistantResponse = buildStudentGreetingResponse(query, userName, userIsTagalog);
            systemPrompt = `You are the official GCT STUDENT AI INQUIRY assistant for Garcia College of Technology.
Logged-in Student: ${userName} (Student ID: ${studentInfo.student_id})
Program: ${studentInfo.program} - Year ${studentInfo.year_level || 1} (${studentInfo.schedule || studentInfo.section || 'Regular'})

CRITICAL GREETING DIRECTIVES (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY DO NOT OUTPUT ANY EVALUATION TABLES, GRADES, GWA, ACTIVE DEFICIENCIES, OR SUBJECT RECOMMENDATIONS.
2. The student sent a conversational greeting: "${query}".
3. Reply warmly, politely, and conversationally in kind (e.g. if they greeted in the morning, greet them good morning; if they said hello/hi, say hello). Address the student by name (${userName}).
4. Keep the response concise, friendly, and welcoming (1 to 2 short paragraphs).
5. State clearly that you are their official GCT Student AI Assistant ready to assist them with:
   - Reviewing their course grades and cumulative GWA
   - Checking upcoming subject recommendations and eligible curriculum load
   - Verifying prerequisite standing and active deficiencies
   - Generating downloadable academic records (Excel, Word, or Text)
6. STRICT ZERO EMOJIS: Do NOT use any emojis or decorative smiley symbols under any circumstance.
7. ABSOLUTELY NO MEMORANDUM FORMAT: Never output "MEMORANDUM", "TO:", "FROM:", "DATE:", or institutional memo headers.
8. PRIMARY LANGUAGE DIRECTIVE: Reply in ${userIsTagalog ? 'Tagalog / Taglish' : 'English'}.
9. MANDATORY FOLLOW-UP QUESTION: Conclude with a helpful question asking how you can assist their academic inquiries today.`;
          } else {
            const { records, recommendations } = await getStudentRecordsAndRecs(studentInfo, db);
          const activeTerm = await getActiveAcademicTerm(db);
          const termAnalysis = extractTargetTermAndSemester(query, studentInfo.year_level || studentInfo.year);

          const isAskingOpinion = isAskingOpinionQuery(query);
          const isStudentAssessment = /\b(assess|assessment|evaluat(?:e|ion)|pagsusuri|comprehensive|full\s+report|overall\s+standing|standing\s+assessment)\b/i.test(query);
          const isStudentGradesQuery = /\b(?:grades?|marka|score|rating|transcript|talaan(?:\s+ng\s+marka)?|records?)\b/i.test(query) && !isAskingOpinion && !isStudentAssessment && !/\b(hi|hello|kumusta|hey)\b/i.test(query);
          const isStudentExplicitAll = /\b(?:all|lahat|entire|complete|buo|cumulative|tor|transcript)\b/i.test(query);

          if (isStudentGradesQuery && !termAnalysis.isSpecificFilter && !isStudentExplicitAll && records.length > 0) {
            const distinctTerms = getDistinctTermsList(records);
            if (distinctTerms.length > 1) {
              const termsListMarkdown = distinctTerms.map(t => `- **${t.displayLabel}**`).join('\n');
              const studentFollowUp = userIsTagalog
                ? `Aling academic year o semestre ang nais mong makitang marka, **${userName}**?\n\n` +
                `**Mga nakatalang termino sa iyong record:**\n` +
                `${termsListMarkdown}\n` +
                `- **Lahat ng Termino (All Terms / Cumulative Summary)**\n\n` +
                `*Piliin o i-type ang nais mong termino (halimbawa: "${distinctTerms[0]?.term || '1st Sem'}" o "Lahat").*`
                : `Which academic term or semester's grades would you like to view, **${userName}**?\n\n` +
                `**Recorded terms on file:**\n` +
                `${termsListMarkdown}\n` +
                `- **All Terms / Cumulative Grade Sheet**\n\n` +
                `*Please select or reply with your desired term (for example: "${distinctTerms[0]?.term || '1st Sem'}" or "All Terms").*`;

              return res.json({
                id: 'chat-' + Date.now(),
                query,
                response: studentFollowUp,
                role: userRole,
                timestamp: new Date().toISOString(),
                file_export: null,
                student_action: {
                  student_id: studentInfo.student_id,
                  student_name: userName,
                  program: studentInfo.program,
                  pending_action: 'clarify_grades_term',
                  available_terms: distinctTerms.map(t => t.term)
                },
                follow_up_questions: distinctTerms.map(t => t.displayLabel).concat(userIsTagalog ? ['Lahat ng Termino'] : ['All Terms'])
              });
            }
          }

          // Filter records if a specific term or semester was requested
          let displayRecords = records;
          let isFilteredByTerm = false;
          let termLabelClean = '';

          if (termAnalysis.isSpecificFilter) {
            const filterYear = termAnalysis.academic_year ? termAnalysis.explicitYear : termAnalysis.year;
            const matching = records.filter(r => matchesRecordTerm(r, filterYear, termAnalysis.semester, termAnalysis.academic_year));
            if (matching.length > 0) {
              displayRecords = matching;
              isFilteredByTerm = true;
              termLabelClean = termAnalysis.target_term ? termAnalysis.target_term.replace(/[^a-zA-Z0-9]+/g, '_') : 'Term';
            }
          }

          const { passedUnits, failedUnits, passedCount, failedCount, gwa } = calculateStudentStats(displayRecords);
          const failedSubjectsList = displayRecords.filter(r => r.status === 'failed');

          const evalData = await getStudentEvaluationData(studentInfo, records, db);
          const studentRecSubjects = evalData?.recommendedSubjects || [];
          const studentTargetTerm = evalData?.targetTerm || { year_level: studentInfo.year_level || 1, semester: 1 };
          const studentTargetTermText = formatTargetTermText(studentTargetTerm.year_level, studentTargetTerm.semester);
          const studentRecsTableMarkdown = buildRecommendationsTableMarkdown(studentRecSubjects);
          const studentGradesTableMarkdown = buildGradesTableMarkdown(displayRecords);
          const studentDeficienciesTable = buildDeficienciesTableMarkdown(evalData?.activeDeficiencies || []);

          const passedSubjectsStr = displayRecords
            .filter(r => r.status === 'passed')
            .map(r => `• ${r.code} (${r.title}) — Grade: ${r.grade} [Passed]`)
            .join('\n') || 'None recorded yet';

          const failedSubjectsStr = displayRecords
            .filter(r => r.status === 'failed')
            .map(r => `• ${r.code} (${r.title}) — Grade: ${r.grade} [Failed/Retake]`)
            .join('\n') || 'None';

          const approvedRecs = recommendations.filter(r => r.status === 'approved');
          const approvedRecsStr = approvedRecs.length > 0
            ? approvedRecs.map(r => {
              let parsed = r.generated_subjects;
              try { if (typeof parsed === 'string') parsed = JSON.parse(parsed); } catch (e) { }
              if (Array.isArray(parsed)) {
                return parsed.map(s => `• ${s.code || s.subject_code} (${s.title || s.subject_title || ''}) [${s.units || 3} units]`).join('\n');
              }
              return 'Approved subjects available in Advising Slip.';
            }).join('\n')
            : (studentRecSubjects.length > 0 ? studentRecsTableMarkdown : 'Pending Registrar review & approval.');

          // Classify student intent
          const isStudentGreeting = isStudentGreetingQuery(query);
          const isStudentAssessmentQuery = !isStudentGreeting && /\b(assess|assessment|evaluat(?:e|ion)|pagsusuri|comprehensive|full\s+report|overall\s+standing|standing\s+assessment)\b/i.test(query);
          const isStudentRecQuery = !isStudentGreeting && (/(?:subject\s+)?recommend(?:ation|ed|ing)?s?|subjects?\s+to\s+take|what\s+subjects?|curriculum\s+load|course\s+load|anong\s+(?:mga\s+)?kukunin/i.test(query)) && !isStudentAssessmentQuery;
          const isStudentGradesOnlyQuery = !isStudentGreeting && isStudentGradesQuery && !isStudentRecQuery && !isStudentAssessmentQuery;

          const lastBotTurn = Array.isArray(history) && history.length > 0
            ? history.filter(h => (h.sender !== 'user' && h.role !== 'user') && (h.text || h.content)).slice(-1)[0]
            : null;
          const lastBotText = String(lastBotTurn?.text || lastBotTurn?.content || '');
          const lastUserTurn = Array.isArray(history) && history.length > 0
            ? history.filter(h => (h.sender === 'user' || h.role === 'user') && (h.text || h.content)).slice(-1)[0]
            : null;
          const lastUserText = String(lastUserTurn?.text || lastUserTurn?.content || '');
          const recentBotTurns = Array.isArray(history) && history.length > 0
            ? history.filter(h => (h.sender !== 'user' && h.role !== 'user') && (h.text || h.content)).slice(-3)
            : [];

          const isStudentFollowUpToGradesPrompt = !isStudentGreeting && !isStudentAssessmentQuery && (
            lastBotTurn?.pending_action === 'clarify_grades_term' ||
            recentBotTurns.some(b =>
              b.pending_action === 'clarify_grades_term' ||
              /which academic term.*grades|aling academic year o semestre.*marka|aling termino.*marka|recorded terms on file|Select term to view grades/i.test(b.text || b.content || '') ||
              /Grade Sheet|Talaan ng Marka|Academic Record/i.test(b.text || b.content || '')
            ) ||
            (/\b(?:grades?|marka|records?)\b/i.test(lastUserText) && !/(?:subject\s+)?recommend/i.test(lastUserText))
          );

          const effectiveStudentGradesQuery = !isStudentGreeting && !isStudentAssessmentQuery && (isStudentGradesOnlyQuery || (isStudentFollowUpToGradesPrompt && !isStudentRecQuery));
          let studentIntent = 'comprehensive';
          if (isStudentGreeting) {
            studentIntent = 'greeting';
          } else if (isStudentAssessmentQuery) {
            studentIntent = 'comprehensive';
          } else if (isStudentRecQuery) {
            studentIntent = 'recommendation';
          } else if (effectiveStudentGradesQuery) {
            studentIntent = 'grades';
          } else {
            studentIntent = classifyStudentQueryIntent(query);
          }

          // Detect requested file format (word, excel, text, pdf)
          const requestedFormat = detectRequestedFileFormat(query);
          let fileData = '';
          let filename = '';
          let fileLabel = '';
          const fileTermLabel = isFilteredByTerm ? ` (${termAnalysis.target_term})` : '';
          const fileTermSuffix = isFilteredByTerm ? `_${termLabelClean}` : '';

          const fileOptions = {
            intent: studentIntent,
            isFilteredByTerm,
            termLabel: termAnalysis.target_term || (isFilteredByTerm ? termLabelClean : 'All Encoded Terms')
          };

          if (studentIntent !== 'greeting') {
            if (requestedFormat === 'word') {
              fileData = generateStudentWord(studentInfo, displayRecords, gwa, fileOptions);
              filename = `${studentInfo.student_id}${fileTermSuffix}_My_Academic_Record.doc`;
              fileLabel = `Download My Academic Record${fileTermLabel} (Word Document)`;
            } else if (requestedFormat === 'text') {
              fileData = generateStudentText(studentInfo, displayRecords, gwa, fileOptions);
              filename = `${studentInfo.student_id}${fileTermSuffix}_My_Academic_Record.txt`;
              fileLabel = `Download My Academic Record${fileTermLabel} (Text File)`;
            } else {
              fileData = generateStudentCsv(studentInfo, displayRecords, gwa, fileOptions);
              filename = `${studentInfo.student_id}${fileTermSuffix}_My_Academic_Record.csv`;
              fileLabel = `Download My Academic Record${fileTermLabel} (Excel Spreadsheet)`;
            }

            fileExport = {
              filename,
              format: requestedFormat,
              csv_data: fileData,
              data: fileData,
              label: fileLabel
            };
          } else {
            fileExport = null;
          }

          studentAction = {
            student_id: studentInfo.student_id,
            student_name: userName,
            program: studentInfo.program,
            intent: studentIntent,
            target_term: termAnalysis.target_term || undefined,
            semester: termAnalysis.semester || undefined,
            year_level: termAnalysis.year || undefined
          };

          const opinionSection = generateStudentOpinion(
            studentInfo,
            { totalUnits: passedUnits + failedUnits, passedUnits, failedUnits, passedCount, failedCount, gwa },
            records,
            failedSubjectsList,
            userIsTagalog
          );

          if (studentIntent === 'greeting') {
            systemPrompt = `You are the official GCT STUDENT AI INQUIRY assistant for Garcia College of Technology.
Logged-in Student: ${userName} (Student ID: ${studentInfo.student_id})
Program: ${studentInfo.program} - Year ${studentInfo.year_level || 1} (${studentInfo.schedule || studentInfo.section || 'Regular'})

CRITICAL GREETING DIRECTIVES (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY DO NOT OUTPUT ANY EVALUATION TABLES, GRADES, GWA, ACTIVE DEFICIENCIES, OR SUBJECT RECOMMENDATIONS.
2. The student sent a conversational greeting: "${query}".
3. Reply warmly, politely, and conversationally in kind (e.g. if they greeted in the morning, greet them good morning; if they said hello/hi, say hello). Address the student by name (${userName}).
4. Keep the response concise, friendly, and welcoming (1 to 2 short paragraphs).
5. State clearly that you are their official GCT Student AI Assistant ready to assist them with:
   - Reviewing their course grades and cumulative GWA
   - Checking upcoming subject recommendations and eligible curriculum load
   - Verifying prerequisite standing and active deficiencies
   - Generating downloadable academic records (Excel, Word, or Text)
6. STRICT ZERO EMOJIS: Do NOT use any emojis or decorative smiley symbols under any circumstance.
7. ABSOLUTELY NO MEMORANDUM FORMAT: Never output "MEMORANDUM", "TO:", "FROM:", "DATE:", or institutional memo headers.
8. PRIMARY LANGUAGE DIRECTIVE: Reply in ${userIsTagalog ? 'Tagalog / Taglish' : 'English'}.
9. MANDATORY FOLLOW-UP QUESTION: Conclude with a helpful question asking how you can assist their academic inquiries today.`;
          } else if (studentIntent === 'grades') {
            systemPrompt = `You are the official GCT STUDENT AI INQUIRY assistant for Garcia College of Technology.
Logged-in Student: ${userName} (Student ID: ${studentInfo.student_id})
Program: ${studentInfo.program} - Year ${studentInfo.year_level || 1} (${studentInfo.schedule || studentInfo.section || 'Regular'})
Cumulative GWA: ${gwa}
Passed: ${passedCount} subjects (${passedUnits} units)
Failed/Retakes: ${failedCount} subjects
Current academic term: ${activeTerm ? `${activeTerm.academicYear}, semester ${activeTerm.semester}` : 'Not configured in system settings'}
Grades recorded for current term: ${activeTerm && hasRecordForAcademicTerm(records, activeTerm.academicYear, activeTerm.semester) ? 'Yes' : 'No'}

OFFICIAL STUDENT EVALUATION TABLES (GROUND TRUTH):
---
Official Grades Table (${isFilteredByTerm ? termAnalysis.target_term : 'All Terms'}):
${studentGradesTableMarkdown}

Active Deficiencies Table:
${studentDeficienciesTable || 'None (Clean academic standing)'}
---

CRITICAL INTENT AND EXCLUSION DIRECTIVE (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY DO NOT INCLUDE SUBJECT RECOMMENDATIONS:
   - The student asked ONLY for their grades / academic record (${isFilteredByTerm ? `for "${termAnalysis.target_term}"` : 'on file'}).
   - DO NOT include, list, advise, or recommend upcoming subjects or future course load to take.
   - DO NOT output any Recommended Subjects table or advising load, because the student did not ask for recommendations.
   - Present ONLY the requested grade sheet, active deficiencies (if any), and an encouraging summary of performance.
2. ABSOLUTELY NO MEMORANDUM FORMAT: Never output "MEMORANDUM", "TO:", "FROM:", "DATE:", "SUBJECT:", or institutional memo headers.
3. MANDATORY MARKDOWN TABLES:
   - When presenting grades, you MUST format them as a Markdown table with columns: | Subject Code | Description | Units | Grade | Status | Academic Term |
   - When presenting active deficiencies, use a Markdown table with columns: | Subject Code | Description | Units | Grade | Status | Term Recorded |
4. CONCISE EXPLANATION: Accompany the table with a clear, encouraging, and honest academic explanation.
5. STRICT ZERO EMOJIS: Do not use emojis or decorative smiley symbols.
6. PRIMARY LANGUAGE DIRECTIVE:
   - Reply in English by default; reply in Tagalog if the student wrote in Tagalog.

USER MESSAGE: "${query}"

Instructions:
- Directly, politely, and conversationally reply to the student's exact message or question.
- DO NOT generate or output any recommended subjects table.
- If they asked to generate a file (Word, Excel, CSV, or Text), confirm that their requested ${requestedFormat.toUpperCase()} file has been generated and is ready to download below!
- MANDATORY FOLLOW-UP QUESTION RULE: Conclude your answer with a relevant follow-up question (e.g. asking if they want to evaluate their overall standing, view recommended subjects for next semester, or check active deficiencies).`;
          } else {
            systemPrompt = `You are the official GCT STUDENT AI INQUIRY assistant for Garcia College of Technology.
Logged-in Student: ${userName} (Student ID: ${studentInfo.student_id})
Program: ${studentInfo.program} - Year ${studentInfo.year_level || 1} (${studentInfo.schedule || studentInfo.section || 'Regular'})
Cumulative GWA: ${gwa}
Passed: ${passedCount} subjects (${passedUnits} units)
Failed/Retakes: ${failedCount} subjects
Current academic term: ${activeTerm ? `${activeTerm.academicYear}, semester ${activeTerm.semester}` : 'Not configured in system settings'}
Grades recorded for current term: ${activeTerm && hasRecordForAcademicTerm(records, activeTerm.academicYear, activeTerm.semester) ? 'Yes' : 'No'}

OFFICIAL STUDENT EVALUATION TABLES (GROUND TRUTH):
---
Official Grades Table (${isFilteredByTerm ? termAnalysis.target_term : 'All Terms'}):
${studentGradesTableMarkdown}

Recommended Subjects Table for Next Term (${studentTargetTermText}):
${studentRecsTableMarkdown}

Active Deficiencies Table:
${studentDeficienciesTable || 'None (Clean academic standing)'}
---

CRITICAL FORMATTING INSTRUCTIONS:
1. ABSOLUTELY NO MEMORANDUM FORMAT: Never output "MEMORANDUM", "TO:", "FROM:", "DATE:", "SUBJECT:", or institutional memo headers.
2. MANDATORY MARKDOWN TABLES: Whenever presenting grades or recommended subjects, ALWAYS format them as structured Markdown tables with pipe '|' delimiters.
3. CONCISE EXPLANATION: Accompany any table with a clear, encouraging, and honest advising explanation.
4. STRICT ZERO EMOJIS: Do not use emojis or decorative smiley symbols.
5. ACCURACY: Strictly ground all subject advice in the official tables provided above.

PRIMARY LANGUAGE DIRECTIVE:
- Your PRIMARY and DEFAULT language is ENGLISH. Always communicate in professional, clear, and structured English by default.
- MANDATORY EXCEPTION: If the user communicates in Tagalog (or Taglish/Filipino), you MUST reply in fluent, natural, and encouraging Tagalog/Taglish.
- SCOPE RESTRICTION: You are STRICTLY an academic assistant for Garcia College of Technology (GCT) Subject Assessment and Recommendation System.

MANDATORY FOLLOW-UP QUESTION DIRECTIVE:
- Conclude your reply with a relevant, proactive follow-up question.
- Guide the student to the next logical step (e.g. asking if they want to review prerequisite requirements, check active deficiencies, or download their record).
- NEVER end your reply without an engaging follow-up question.

USER MESSAGE: "${query}"

Instructions:
- Directly, politely, and conversationally reply to the student's exact message or question.
- If they asked to generate a file (Word, Excel, CSV, or Text), confirm that their requested ${requestedFormat.toUpperCase()} file has been generated and is ready to download below!
- If they ask about their grades, GWA, prerequisites, or advice, explain clearly using the verified facts above.
- Format course grades and recommended subjects into Markdown tables.
- Do not infer year promotion or enrollment eligibility from cumulative passed-subject counts alone. Confirm active-term grades and required curriculum/prerequisite completion first.
- Language Rule: Reply in English by default; reply in Tagalog if the student wrote in Tagalog.
- Always conclude with an engaging follow-up question.`;
          }

          if (isAskingOpinion) {
            assistantResponse = userIsTagalog
              ? `Hello po, **${userName}**! Narito ang aking opisyal na academic advising opinion at pagsusuri sa iyong academic standing:\n\n${opinionSection}\n\n**Kasalukuyang Buod ng Academic Standing:**\n- **Student ID:** \`${studentInfo.student_id}\`\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Track)'}**\n\n*Gamitin ang mga pindutan sa ibaba upang i-download ang iyong academic record o konsultahin ang iyong advising slip.*\n\nNais mo bang makita ang iyong mga inirerekomendang asignatura para sa susunod na semestre batay sa pagsusuring ito?`
              : `Hello **${userName}**! Here is my academic advising opinion regarding your standing:

${opinionSection}

**Current Academic Summary:**
- **Student ID:** \`${studentInfo.student_id}\`
- **Cumulative GWA:** **${gwa}**
- **Passed Units:** **${passedUnits}** units (${passedCount} subjects)
- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Track)'}**

*Use the buttons below to download your complete academic record or consult your full advising matrix.*

Would you like me to generate your recommended subjects for next semester based on this evaluation, or download your official advising record?`;
          } else if (studentIntent === 'greeting') {
            assistantResponse = buildStudentGreetingResponse(query, userName, userIsTagalog);
          } else {
            if (studentIntent === 'recommendation') {
              assistantResponse = userIsTagalog
                ? `Hello po, **${userName}**! Narito ang iyong inirerekomendang mga asignatura para sa **${studentTargetTermText}**:\n\n- **Student ID:** \`${studentInfo.student_id}\`\n- **Program & Taon:** ${studentInfo.program} - Year ${studentInfo.year_level || 1}\n- **Cumulative GWA:** **${gwa}**\n- **Target Term:** **${studentTargetTermText}**\n\n#### Mga Inirerekomendang Asignatura:\n${studentRecsTableMarkdown}\n\n${evalData?.activeDeficiencies?.length > 0 ? `#### Mga Aktibong Deficiency (Kailangang I-retake):\n${studentDeficienciesTable}\n\n` : ''}*Maaari mong i-download ang iyong advising record gamit ang buttons sa ibaba.*\n\nNais mo bang suriin ang mga prerequisite para sa mga inirerekomendang asignaturang ito, o tingnan ang iyong active deficiencies?`
                : `Hello **${userName}**! Here are your recommended subjects for **${studentTargetTermText}**:

- **Student ID:** \`${studentInfo.student_id}\`
- **Program & Year:** ${studentInfo.program} - Year ${studentInfo.year_level || 1}
- **Cumulative GWA:** **${gwa}**
- **Target Advising Term:** **${studentTargetTermText}**

#### Recommended Subjects for Upcoming Term:
${studentRecsTableMarkdown}

${evalData?.activeDeficiencies?.length > 0 ? `#### Active Deficiencies (Retakes Required):\n${studentDeficienciesTable}\n\n` : ''}*You can download your advising slip and academic record using the buttons below.*

Would you like to review the specific prerequisite requirements for these recommended subjects, or check your active deficiencies?`;
            } else if (studentIntent === 'grades') {
              assistantResponse = userIsTagalog
                ? `Hello po, **${userName}**! Narito ang iyong opisyal na talaan ng mga marka:\n\n- **Student ID:** \`${studentInfo.student_id}\`\n- **Program & Taon:** ${studentInfo.program} - Year ${studentInfo.year_level || 1}\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n\n#### Talaan ng Marka (${isFilteredByTerm ? termAnalysis.target_term : 'Lahat ng Termino'}):\n${studentGradesTableMarkdown}\n\n${evalData?.activeDeficiencies?.length > 0 ? `#### Mga Aktibong Deficiency:\n${studentDeficienciesTable}\n\n` : ''}*Maaari mong i-download ang iyong kumpletong rekord bilang ${requestedFormat.toUpperCase()} file sa ibaba.*\n\nNais mo bang suriin natin ang iyong overall standing at kalkulahin ang iyong mga inirerekomendang asignatura para sa susunod na semestre?`
                : `Hello **${userName}**! Here is your official grade sheet:

- **Student ID:** \`${studentInfo.student_id}\`
- **Program & Year:** ${studentInfo.program} - Year ${studentInfo.year_level || 1}
- **Cumulative GWA:** **${gwa}**
- **Passed Units:** **${passedUnits}** units (${passedCount} subjects)

#### Grade Sheet (${isFilteredByTerm ? termAnalysis.target_term : 'All Terms'}):
${studentGradesTableMarkdown}

${evalData?.activeDeficiencies?.length > 0 ? `#### Active Deficiencies:\n${studentDeficienciesTable}\n\n` : ''}*You can download your complete record as a ${requestedFormat.toUpperCase()} file below.*

Would you like me to evaluate your overall standing and compute your recommended subjects for the upcoming semester?`;
            } else {
              assistantResponse = userIsTagalog
                ? `Hello po, **${userName}**! Narito ang iyong verified academic standing at buod ng rekord:\n\n- **Student ID:** \`${studentInfo.student_id}\`\n- **Program & Taon:** ${studentInfo.program} - Year ${studentInfo.year_level || 1}\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Deficiencies:** ${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Track)'}\n\n#### Mga Inirerekomendang Asignatura (${studentTargetTermText}):\n${studentRecsTableMarkdown}\n\n#### Talaan ng Marka (${isFilteredByTerm ? termAnalysis.target_term : 'Lahat ng Termino'}):\n${studentGradesTableMarkdown}\n\n*Maaari mong i-download ang iyong kumpletong rekord bilang ${requestedFormat.toUpperCase()} file sa ibaba.*\n\nNais mo bang suriin ang mga prerequisite para sa mga darating na asignatura, o i-download ang iyong opisyal na ulat sa Excel?`
                : `Hello **${userName}**! Here is your verified academic standing and course summary:

- **Student ID:** \`${studentInfo.student_id}\`
- **Program & Year:** ${studentInfo.program} - Year ${studentInfo.year_level || 1}
- **Cumulative GWA:** **${gwa}**
- **Passed Units:** **${passedUnits}** units (${passedCount} subjects)
- **Deficiencies:** ${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Track)'}

#### Recommended Subjects for Next Term (${studentTargetTermText}):
${studentRecsTableMarkdown}

#### Grade Sheet (${isFilteredByTerm ? termAnalysis.target_term : 'All Terms'}):
${studentGradesTableMarkdown}

*You can download your complete academic record as a ${requestedFormat.toUpperCase()} file below.*

Would you like to explore specific prerequisite dependencies for these upcoming subjects, or download your complete academic evaluation in Excel?`;
            }
          }

          const enrollmentEligibilityResponse = buildEnrollmentEligibilityResponse(
            query,
            studentInfo,
            records,
            activeTerm,
            userIsTagalog
          );
          if (enrollmentEligibilityResponse) {
            assistantResponse = enrollmentEligibilityResponse;
            systemPrompt = '';
          }
          }
        }
      }
    }

    // =========================================================================
    // 3. ADMIN & REGISTRAR STAFF ROLE CHATBOT LOGIC
    // Has full access to ALL students!
    // Generates downloadable CSV/Excel and direct links to Academic Records & Recommendations!
    // =========================================================================
    else {
      // 1. Check if multiple students were queried (e.g. "student id 1111,2222,3333 show me their record")
      const multiStudents = await findMultipleTargetStudents(query, db);

      if (multiStudents.length >= 2) {
        // MULTI-STUDENT FLOW
        const isAssessmentQuery = /\b(assess|assessment|evaluat(?:e|ion)|pagsusuri|comprehensive|full\s+report|overall\s+standing|standing\s+assessment)\b/i.test(query);
        const isRecQuery = (/(?:subject\s+)?recommend(?:ation|ed|ing)?s?|subjects?\s+to\s+take|what\s+subjects?|curriculum\s+load|course\s+load|anong\s+(?:mga\s+)?kukunin/i.test(query)) && !isAssessmentQuery;
        const isGradesQuery = (/\b(?:grades?|marka|score|rating|transcript|talaan(?:\s+ng\s+marka)?|records?|academic\s+records?)\b/i.test(query)) && !isAssessmentQuery;
        const termAnalysis = extractTargetTermAndSemester(query);

        let activeAcademicYear = '2026-2027';
        try {
          const { data: sData } = await db.from('settings').select('key, value').in('key', ['activeAcademicYear', 'active_academic_year']);
          if (sData?.[0]?.value) activeAcademicYear = String(sData[0].value).trim();
        } catch (e) { }

        const multiStudentsData = [];
        const studentSections = [];

        for (let idx = 0; idx < multiStudents.length; idx++) {
          const s = multiStudents[idx];
          const { records } = await getStudentRecordsAndRecs(s, db);
          const cleanId = String(s.student_id || s.id || 'N/A').replace(/^GCT-/i, '').trim();
          const sName = s.name || s.full_name || 'Student';
          const sProg = s.program || 'BSIT';
          const sYear = s.year_level || s.year || 1;

          const enrollmentStatus = getStudentEnrollmentStatus(s, records, activeAcademicYear);
          const { totalUnits, passedUnits, failedUnits, passedCount, failedCount, gwa } = calculateStudentStats(records);

          const targetTermOverride = termAnalysis.isSpecificFilter ? { year: termAnalysis.year, semester: termAnalysis.semester } : null;
          const evalData = await getStudentEvaluationData(s, records, db, targetTermOverride);
          const { recommendedSubjects, activeDeficiencies, targetTerm, totalRecommendedUnits } = evalData;
          const targetTermText = formatTargetTermText(targetTerm?.year_level, targetTerm?.semester);

          const gradesTable = buildGradesTableMarkdown(records);
          const recsTable = buildRecommendationsTableMarkdown(recommendedSubjects);
          const defTable = buildDeficienciesTableMarkdown(activeDeficiencies);

          multiStudentsData.push({
            student: s,
            records,
            gwa,
            recommendations: recommendedSubjects,
            targetTermText,
            enrollmentStatus
          });

          // Build markdown section for this student
          let sMarkdown = userIsTagalog
            ? `### ${idx + 1}. **${sName}** (\`${cleanId}\`)\n` +
            `- **Program & Taon:** ${sProg} — Year ${sYear}\n` +
            `- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n` +
            `- **Cumulative GWA:** **${gwa}** | **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n` +
            `- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Track)'}**\n` +
            (enrollmentStatus.isStoppedOrLapsed ? `> ⚠️ **Paunawa:** May patlang sa enrollment ang estudyante. Huling pumasok noong **${enrollmentStatus.lastEnrolledTerm}**.\n\n` : '\n')
            : `### ${idx + 1}. **${sName}** (\`${cleanId}\`)\n` +
            `- **Program & Year:** ${sProg} — Year ${sYear}\n` +
            `- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n` +
            `- **Cumulative GWA:** **${gwa}** | **Passed Units:** **${passedUnits}** units (${passedCount} subjects)\n` +
            `- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Track)'}**\n` +
            (enrollmentStatus.isStoppedOrLapsed ? `> ⚠️ **Notice:** Student has an enrollment gap. Last attended term was **${enrollmentStatus.lastEnrolledTerm}**.\n\n` : '\n');

          if (isRecQuery && !isGradesQuery) {
            sMarkdown += userIsTagalog
              ? `#### Inirerekomendang mga Asignatura (${targetTermText} • ${totalRecommendedUnits} Units):\n${recsTable}\n\n` +
              (activeDeficiencies.length > 0 ? `#### Mga Aktibong Deficiency:\n${defTable}\n\n` : '')
              : `#### Recommended Subjects for ${targetTermText} (${totalRecommendedUnits} Units):\n${recsTable}\n\n` +
              (activeDeficiencies.length > 0 ? `#### Active Deficiencies:\n${defTable}\n\n` : '');
          } else if (isGradesQuery && !isRecQuery) {
            sMarkdown += userIsTagalog
              ? `#### Talaan ng mga Marka (${records.length} subjects):\n${gradesTable}\n\n`
              : `#### Academic Grade Sheet (${records.length} subjects):\n${gradesTable}\n\n`;
          } else {
            // Both or general record inquiry
            sMarkdown += userIsTagalog
              ? `#### Inirerekomendang mga Asignatura (${targetTermText} • ${totalRecommendedUnits} Units):\n${recsTable}\n\n` +
              (activeDeficiencies.length > 0 ? `#### Mga Aktibong Deficiency:\n${defTable}\n\n` : '') +
              `#### Talaan ng Marka (${records.length} subjects):\n${gradesTable}\n\n`
              : `#### Recommended Subjects for ${targetTermText} (${totalRecommendedUnits} Units):\n${recsTable}\n\n` +
              (activeDeficiencies.length > 0 ? `#### Active Deficiencies:\n${defTable}\n\n` : '') +
              `#### Academic Grade Sheet (${records.length} subjects):\n${gradesTable}\n\n`;
          }

          studentSections.push(sMarkdown);
        }

        // Generate Multi-Student Excel File (CSV formatted for Excel with spacing between students)
        const multiCsv = generateMultiStudentCsv(multiStudentsData);
        fileExport = {
          filename: `Multi_Student_Academic_Report_${Date.now()}.csv`,
          format: 'excel',
          csv_data: multiCsv,
          data: multiCsv,
          label: `Download Multi-Student Records (${multiStudents.length} Students) (Excel Spreadsheet)`
        };

        const introHeader = userIsTagalog
          ? `### Ulat sa Academic Records ng Maramihang Estudyante (${multiStudents.length} Students)\nNarito ang pinagsama-samang rekord batay sa inyong kahilingan:\n\n`
          : `### Multi-Student Academic Records & Evaluation Report (${multiStudents.length} Students)\nHere is the evaluated breakdown for the requested students:\n\n`;

        const downloadNotice = userIsTagalog
          ? `\n*Maaari mong i-download ang buong pinagsamang rekord ng lahat ng estudyante bilang **Excel Spreadsheet** gamit ang download button sa ibaba.*\n\nNais mo bang suriin nang mas detalyado ang rekord ng isa sa mga estudyanteng ito, o i-filter ang mga may bagsak na asignatura?`
          : `\n*You can download the complete combined records of all students as an **Excel Spreadsheet** using the download button below.*\n\nWould you like to drill down into a specific student's record, or filter these students by active deficiencies?`;

        assistantResponse = introHeader + studentSections.join('\n---\n\n') + downloadNotice;
      }
      // 2. COHORT / ROSTER / YEAR LEVEL / PROGRAM FILTER FLOW
      // (Handles records by course/program, all year levels or per year level, subject recommendations, and clarification follow-ups)
      else if (multiStudents.length === 0 && (() => {
        const lastBotTurn = Array.isArray(history) && history.length > 0
          ? history.filter(h => (h.sender !== 'user' && h.role !== 'user') && (h.student_action || h.pending_action || h.text || h.content)).slice(-1)[0]
          : null;
        const pendingCohort = lastBotTurn?.student_action?.pending_action === 'clarify_cohort_details'
          ? lastBotTurn.student_action
          : (lastBotTurn?.pending_action === 'clarify_cohort_details' ? lastBotTurn : null);
        return parseCohortFilter(query).isCohortQuery || Boolean(pendingCohort);
      })()) {
        const lastBotTurn = Array.isArray(history) && history.length > 0
          ? history.filter(h => (h.sender !== 'user' && h.role !== 'user') && (h.student_action || h.pending_action || h.text || h.content)).slice(-1)[0]
          : null;
        const pendingCohort = lastBotTurn?.student_action?.pending_action === 'clarify_cohort_details'
          ? lastBotTurn.student_action
          : (lastBotTurn?.pending_action === 'clarify_cohort_details' ? lastBotTurn : null);

        let cohortFilter = parseCohortFilter(query);

        // Merge previous turn's clarification context if pending
        if (pendingCohort) {
          cohortFilter.isCohortQuery = true;
          if (cohortFilter.cohortType === 'directory') {
            cohortFilter.cohortType = pendingCohort.cohort_type || 'grades';
          }
          if (!cohortFilter.program && pendingCohort.program) {
            cohortFilter.program = pendingCohort.program;
          }
          if (cohortFilter.yearLevel === null && pendingCohort.year_level != null) {
            cohortFilter.yearLevel = pendingCohort.year_level;
          }
          if (!cohortFilter.isGroupByProgram && pendingCohort.is_group_by_program) {
            cohortFilter.isGroupByProgram = true;
          }
        }

        // Check if query details are incomplete for grades or recommendation
        if (!isCohortDetailsComplete(cohortFilter)) {
          const isTagalog = userIsTagalog;
          const targetLabel = cohortFilter.cohortType === 'recommendation'
            ? (isTagalog ? 'inirerekomendang mga asignatura (subject recommendations)' : 'recommended subjects')
            : (isTagalog ? 'talaan ng mga marka (grade records)' : 'grade records');

          if (!cohortFilter.program && !cohortFilter.isGroupByProgram && cohortFilter.yearLevel === null) {
            // Missing BOTH Program and Year Level
            assistantResponse = isTagalog
              ? `Upang maipakita ang opisyal na **${targetLabel}**, pakitukoy ang **kurso o programa** at **year level**:\n\n` +
                `**Mga Programang Pagpipilian:**\n` +
                `- **BSIT** (Information Technology)\n` +
                `- **BSCS** (Computer Science)\n` +
                `- **BSHM** (Hospitality Management)\n` +
                `- **BSBA** (Business Administration)\n` +
                `- **BSA** (Accountancy)\n` +
                `- **Lahat ng Programa (All Degree Programs / By Course)**\n\n` +
                `**Year Level:** \`1st Year\`, \`2nd Year\`, \`3rd Year\`, \`4th Year\`, o \`Lahat ng Year Level\`.\n\n` +
                `*Halimbawa ng itatype: "BSIT 2nd Year" o "BSCS Lahat ng Taon".*`
              : `To review official **${targetLabel}**, please specify your preferred **degree program** and **year level**:\n\n` +
                `**Degree Programs:**\n` +
                `- **BSIT** (Information Technology)\n` +
                `- **BSCS** (Computer Science)\n` +
                `- **BSHM** (Hospitality Management)\n` +
                `- **BSBA** (Business Administration)\n` +
                `- **BSA** (Accountancy)\n` +
                `- **All Degree Programs (By Course)**\n\n` +
                `**Year Level:** \`1st Year\`, \`2nd Year\`, \`3rd Year\`, \`4th Year\`, or \`All Year Levels\`.\n\n` +
                `*Example query: "BSIT 2nd Year" or "BSCS All Year Levels".*`;
          } else if (!cohortFilter.program && !cohortFilter.isGroupByProgram) {
            // Missing PROGRAM
            const ylText = cohortFilter.yearLevel === 'all'
              ? (isTagalog ? 'Lahat ng Year Level' : 'All Year Levels')
              : `Year ${cohortFilter.yearLevel}`;
            assistantResponse = isTagalog
              ? `Para sa **${ylText}**, para sa aling **kurso o programa** ang nais ninyong makita ang **${targetLabel}**?\n\n` +
                `- **BSIT** (Bachelor of Science in Information Technology)\n` +
                `- **BSCS** (Bachelor of Science in Computer Science)\n` +
                `- **BSHM** (Bachelor of Science in Hospitality Management)\n` +
                `- **BSBA** (Bachelor of Science in Business Administration)\n` +
                `- **BSA** (Bachelor of Science in Accountancy)\n` +
                `- **Lahat ng Programa (All Programs / By Course)**\n\n` +
                `*Pakisabi ang kurso (halimbawa: "BSIT" o "Lahat") upang maihanda ang ulat at Excel download.*`
              : `For **${ylText}**, which **degree program** would you like to review for **${targetLabel}**?\n\n` +
                `- **BSIT** (Bachelor of Science in Information Technology)\n` +
                `- **BSCS** (Bachelor of Science in Computer Science)\n` +
                `- **BSHM** (Bachelor of Science in Hospitality Management)\n` +
                `- **BSBA** (Bachelor of Science in Business Administration)\n` +
                `- **BSA** (Bachelor of Science in Accountancy)\n` +
                `- **All Degree Programs (By Course)**\n\n` +
                `*Please reply with your preferred program (e.g. "BSIT" or "All Programs") to view records and generate the Excel file.*`;
          } else {
            // Missing YEAR LEVEL
            const progText = cohortFilter.program || 'napiling programa';
            assistantResponse = isTagalog
              ? `Para sa programang **${progText}**, aling **year level** ang nais ninyong makita ang **${targetLabel}**?\n\n` +
                `- **1st Year**\n` +
                `- **2nd Year**\n` +
                `- **3rd Year**\n` +
                `- **4th Year**\n` +
                `- **Lahat ng Year Level (All Year Levels)**\n\n` +
                `*Pakisabi kung aling taon (halimbawa: "2nd Year" o "Lahat") upang mai-generate ko ang kumpletong talaan at Excel file.*`
              : `For the **${progText}** program, which **year level** would you like to review for **${targetLabel}**?\n\n` +
                `- **1st Year**\n` +
                `- **2nd Year**\n` +
                `- **3rd Year**\n` +
                `- **4th Year**\n` +
                `- **All Year Levels**\n\n` +
                `*Please reply with your preferred year level (e.g. "2nd Year" or "All Year Levels") to generate the full report and Excel spreadsheet.*`;
          }

          systemPrompt = '';
          studentAction = {
            pending_action: 'clarify_cohort_details',
            cohort_type: cohortFilter.cohortType,
            program: cohortFilter.program || undefined,
            year_level: cohortFilter.yearLevel || undefined,
            is_group_by_program: cohortFilter.isGroupByProgram || undefined
          };
        } else {
          // Details are COMPLETE!
          let { data: stData, error: stErr } = await db.from('students').select('id, student_id, full_name, program, year_level, status');
          if (stErr || !stData || stData.length === 0) {
            if (stErr) console.warn('Students directory query notice, checking fallback select(*):', stErr.message);
            try {
              const { data: fallbackData } = await db.from('students').select('*');
              if (fallbackData && fallbackData.length > 0) {
                stData = fallbackData;
              }
            } catch (fbErr) {}
          }
          const rawStudents = stData || [];
          const totalInDb = rawStudents.length;

          // Sort reliably in memory by program, year level, and student ID
          const allStudents = [...rawStudents].sort((a, b) => {
            const pA = String(a.program || 'BSIT');
            const pB = String(b.program || 'BSIT');
            if (pA !== pB) return pA.localeCompare(pB);
            const yA = Number(a.year_level || a.year || 1);
            const yB = Number(b.year_level || b.year || 1);
            if (yA !== yB) return yA - yB;
            const sA = String(a.student_id || a.id || '');
            const sB = String(b.student_id || b.id || '');
            return sA.localeCompare(sB);
          });

          let filtered = [...allStudents];

          if (cohortFilter.program) {
            const pTarget = cohortFilter.program.toUpperCase();
            filtered = filtered.filter(s => {
              const p = String(s.program || 'BSIT').toUpperCase();
              return p === pTarget || p.startsWith(pTarget);
            });
          }

          if (cohortFilter.yearLevel && cohortFilter.yearLevel !== 'all') {
            const yTarget = Number(cohortFilter.yearLevel);
            filtered = filtered.filter(s => {
              const y = Number(s.year_level || s.year || 1);
              return y === yTarget;
            });
          }

          let yearLabel = '';
          let yearFileTag = '';
          if (cohortFilter.yearLevel === 1) {
            yearLabel = userIsTagalog ? 'Unang Taon (1st Year Only)' : '1st Year Records Only';
            yearFileTag = '1st_Year';
          } else if (cohortFilter.yearLevel === 2) {
            yearLabel = userIsTagalog ? 'Ikalawang Taon (2nd Year Only)' : '2nd Year Records Only';
            yearFileTag = '2nd_Year';
          } else if (cohortFilter.yearLevel === 3) {
            yearLabel = userIsTagalog ? 'Ikatlong Taon (3rd Year Only)' : '3rd Year Records Only';
            yearFileTag = '3rd_Year';
          } else if (cohortFilter.yearLevel === 4) {
            yearLabel = userIsTagalog ? 'Ikaapat na Taon (4th Year Only)' : '4th Year Records Only';
            yearFileTag = '4th_Year';
          } else if (cohortFilter.yearLevel === 'all') {
            yearLabel = userIsTagalog ? 'Lahat ng Year Level (1st, 2nd, 3rd, 4th Year)' : 'All Year Levels (1st, 2nd, 3rd, 4th Year)';
            yearFileTag = 'All_Year_Levels';
          } else {
            yearLabel = userIsTagalog ? 'Lahat ng Year Level' : 'All Year Levels';
            yearFileTag = 'All_Years';
          }

          let programLabel = '';
          let programFileTag = '';
          if (cohortFilter.program) {
            programLabel = cohortFilter.program;
            programFileTag = cohortFilter.program;
          } else if (cohortFilter.isGroupByProgram) {
            programLabel = userIsTagalog ? 'Naka-grupo bawat Kurso / Programa' : 'Grouped by Degree Program';
            programFileTag = 'By_Program';
          } else {
            programLabel = userIsTagalog ? 'Lahat ng Programa' : 'All Degree Programs';
            programFileTag = 'All_Programs';
          }

          // BRANCH A: SUBJECT RECOMMENDATIONS
          if (cohortFilter.cohortType === 'recommendation') {
            let subQuery = db.from('subjects').select('*');
            if (cohortFilter.program) {
              subQuery = subQuery.eq('program', cohortFilter.program);
            }
            if (cohortFilter.yearLevel && cohortFilter.yearLevel !== 'all') {
              subQuery = subQuery.eq('year_level', Number(cohortFilter.yearLevel));
            }
            const { data: subsData } = await subQuery;
            const subjectsList = (subsData || []).sort((a, b) => {
              const pComp = String(a.program || '').localeCompare(String(b.program || ''));
              if (pComp !== 0) return pComp;
              const yDiff = Number(a.year_level || 1) - Number(b.year_level || 1);
              if (yDiff !== 0) return yDiff;
              const semDiff = Number(a.semester || 1) - Number(b.semester || 1);
              if (semDiff !== 0) return semDiff;
              return String(a.code || '').localeCompare(String(b.code || ''));
            });

            // Fetch prerequisites
            let prereqMap = new Map();
            try {
              const { data: prData } = await db.from('prerequisites').select('*');
              const subCodeMap = new Map((subsData || []).map(s => [s.id, s.code]));
              (prData || []).forEach(p => {
                const reqCode = subCodeMap.get(p.prerequisite_subject_id) || p.prerequisite_subject_id;
                if (!prereqMap.has(p.subject_id)) prereqMap.set(p.subject_id, []);
                prereqMap.get(p.subject_id).push(reqCode);
              });
            } catch (e) {}

            subjectsList.forEach(s => {
              if (!s.prerequisites_text) {
                const prs = prereqMap.get(s.id);
                s.prerequisites_text = (prs && prs.length > 0) ? prs.join(', ') : 'None';
              }
            });

            const totalUnits = subjectsList.reduce((sum, s) => sum + (Number(s.units) || 3), 0);
            const fileBaseName = `GCT_Subject_Recommendations_${programFileTag}_${yearFileTag}_${Date.now()}`;
            const recsCsv = generateCurriculumRecsCsv(subjectsList, fileBaseName);

            fileExport = {
              filename: `${fileBaseName}.csv`,
              format: 'excel',
              csv_data: recsCsv,
              data: recsCsv,
              label: `Download ${programLabel} ${yearLabel} Subject Recommendations (${subjectsList.length} Subjects) (Excel Spreadsheet)`
            };

            const recsTableMarkdown = buildCurriculumTableMarkdown(subjectsList, 25);

            assistantResponse = userIsTagalog
              ? `### Opisyal na Inirerekomendang mga Asignatura (Subject Recommendations)\n\n` +
                `**Buod ng Rekomendasyon:**\n` +
                `- **Kurso / Programa:** **${programLabel}**\n` +
                `- **Year Level:** **${yearLabel}**\n` +
                `- **Kabuuang Asignatura:** **${subjectsList.length}** subjects\n` +
                `- **Kabuuang Units:** **${totalUnits}** units\n\n` +
                `#### Talaan ng mga Inirerekomendang Asignatura:\n` +
                `${recsTableMarkdown}\n` +
                (subjectsList.length > 25 ? `\n*... at ${subjectsList.length - 25} pang mga asignatura sa curriculum matrix.*\n` : '\n') +
                `\n---\n*Maaari mong i-download ang kumpletong curriculum recommendations bilang **Excel Spreadsheet** gamit ang button sa ibaba.*\n\n` +
                `Nais mo bang tingnan ang talaan ng mga marka (grade records) para sa taong ito, o suriin ang ibang programa?`
              : `### Official Curriculum Subject Recommendations\n\n` +
                `**Recommendation Overview:**\n` +
                `- **Degree Program:** **${programLabel}**\n` +
                `- **Year Level:** **${yearLabel}**\n` +
                `- **Total Recommended Subjects:** **${subjectsList.length}** subjects\n` +
                `- **Total Academic Load:** **${totalUnits}** units\n\n` +
                `#### Curriculum Subjects Matrix:\n` +
                `${recsTableMarkdown}\n` +
                (subjectsList.length > 25 ? `\n*... and ${subjectsList.length - 25} more subjects in the curriculum matrix.*\n` : '\n') +
                `\n---\n*The complete curriculum recommendations have been exported and are ready to download as an **Excel Spreadsheet** below.*\n\n` +
                `Would you like to review the student grade records for this cohort, or check another program?`;

            systemPrompt = '';
          }
          // BRANCH B: COHORT GRADE RECORDS (Matches official Academic Records / ALL GRADES structure)
          else if (cohortFilter.cohortType === 'grades') {
            // Build lookup of students in cohort to enrich grade records with full profiles
            const cohortStudentMap = new Map();
            for (const st of filtered) {
              const sid = String(st.student_id || st.id || '').trim();
              const cleanSid = sid.replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^gct-/i, '').toLowerCase();
              if (sid) cohortStudentMap.set(sid.toLowerCase(), st);
              if (cleanSid) cohortStudentMap.set(cleanSid, st);
            }

            // Query grade_records with fallback and cross-referencing to ensure complete dataset
            let rawGradeRows = [];
            try {
              let grQuery = db.from('grade_records').select('*');
              if (cohortFilter.program) {
                grQuery = grQuery.eq('course', cohortFilter.program);
              }
              if (cohortFilter.yearLevel && cohortFilter.yearLevel !== 'all') {
                grQuery = grQuery.eq('year_level', Number(cohortFilter.yearLevel));
              }
              const { data: grData, error: grErr } = await grQuery;
              if (grData && grData.length > 0) {
                rawGradeRows.push(...grData);
              }

              // Cross-reference: if cohort filtered students have records by student_id not captured above
              if (filtered.length > 0 && rawGradeRows.length < filtered.length) {
                const sids = filtered.map(s => String(s.student_id || s.id || '').trim()).filter(Boolean);
                if (sids.length > 0 && sids.length <= 200) {
                  const { data: bySidData } = await db.from('grade_records').select('*').in('student_id', sids);
                  if (bySidData && bySidData.length > 0) {
                    const existingKeys = new Set(rawGradeRows.map(g => `${g.id || ''}-${g.student_id}-${g.subject}`));
                    for (const bg of bySidData) {
                      const key = `${bg.id || ''}-${bg.student_id}-${bg.subject}`;
                      if (!existingKeys.has(key)) {
                        existingKeys.add(key);
                        rawGradeRows.push(bg);
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('Grade records query notice:', err.message);
            }

            // Enrich all grade rows to strictly match official CompleteGradeRow institutional format
            const gradeRows = rawGradeRows.map(g => {
              const gSid = String(g.student_id || '').trim();
              const gCleanSid = gSid.replace(/^student-/i, '').replace(/^acc-/i, '').replace(/^gct-/i, '').toLowerCase();
              const matchedStudent = cohortStudentMap.get(gSid.toLowerCase()) || cohortStudentMap.get(gCleanSid);

              const parsedName = parseNameParts(g.full_name || matchedStudent?.full_name || matchedStudent?.name || `${g.last_name || ''}, ${g.first_name || ''}`);
              const lastName = String(g.last_name || parsedName.lastName).trim();
              const firstName = String(g.first_name || parsedName.firstName).trim();
              const fullName = parsedName.displayName || `${lastName}, ${firstName}`.trim();

              const course = String(g.course || matchedStudent?.program || cohortFilter.program || 'BSIT').trim().toUpperCase();
              const yearLevel = Number(g.year_level || matchedStudent?.year_level || matchedStudent?.year || (cohortFilter.yearLevel !== 'all' ? cohortFilter.yearLevel : 1)) || 1;

              let semStr = 'First';
              const rawSem = String(g.semester || g.semester_name || g.term || '').toLowerCase();
              if (rawSem.includes('summer') || rawSem === '3') {
                semStr = 'Summer';
              } else if (rawSem.includes('2') || rawSem.includes('second')) {
                semStr = 'Second';
              } else {
                semStr = 'First';
              }

              const academicYear = String(g.academic_year || (g.term && g.term.match(/\d{4}-\d{4}/)?.[0]) || '2025-2026').trim();
              const subject = String(g.subject || g.subject_code || g.code || 'N/A').trim();
              const units = Number(g.units) || 3;

              return {
                ...g,
                student_id: gSid || matchedStudent?.student_id || matchedStudent?.id || '',
                last_name: lastName,
                first_name: firstName,
                full_name: fullName,
                name: fullName,
                course,
                year_level: yearLevel,
                semester: semStr,
                academic_year: academicYear,
                subject,
                grade: g.grade,
                units
              };
            });

            // Sort chronologically and alphabetically
            gradeRows.sort((a, b) => {
              const nA = String(a.full_name || a.student_id || '');
              const nB = String(b.full_name || b.student_id || '');
              const nComp = nA.localeCompare(nB);
              if (nComp !== 0) return nComp;
              const yA = Number(a.year_level) || 1;
              const yB = Number(b.year_level) || 1;
              if (yA !== yB) return yA - yB;
              const ayA = String(a.academic_year || '');
              const ayB = String(b.academic_year || '');
              if (ayA !== ayB) return ayA.localeCompare(ayB);
              const semA = String(a.semester || '');
              const semB = String(b.semester || '');
              return semA.localeCompare(semB);
            });

            // Group by student for Markdown summary table
            const studentMap = new Map();
            for (const g of gradeRows) {
              const sid = String(g.student_id || '').trim();
              if (!sid) continue;
              if (!studentMap.has(sid)) {
                studentMap.set(sid, {
                  student_id: sid,
                  full_name: g.full_name || `${g.last_name || ''}, ${g.first_name || ''}`.trim() || 'Student',
                  program: g.course || cohortFilter.program || 'BSIT',
                  year_level: g.year_level || cohortFilter.yearLevel || 1,
                  totalUnits: 0,
                  totalGradePoints: 0,
                  passedUnits: 0,
                  failedUnits: 0,
                  passedCount: 0,
                  failedCount: 0,
                  grades: []
                });
              }
              const entry = studentMap.get(sid);
              const u = Number(g.units) || 3;
              const rawG = Number(g.grade);
              entry.grades.push(g);
              if (!isNaN(rawG) && rawG > 0) {
                entry.totalUnits += u;
                entry.totalGradePoints += rawG * u;
                if (g.status === 'passed' || (rawG <= 3.0 && rawG >= 1.0) || rawG >= 75) {
                  entry.passedUnits += u;
                  entry.passedCount++;
                } else {
                  entry.failedUnits += u;
                  entry.failedCount++;
                }
              } else if (g.status === 'passed') {
                entry.passedUnits += u;
                entry.passedCount++;
              } else if (g.status === 'failed') {
                entry.failedUnits += u;
                entry.failedCount++;
              }
            }

            const studentSummaries = Array.from(studentMap.values()).map(s => {
              const gwa = s.totalUnits > 0 ? (s.totalGradePoints / s.totalUnits).toFixed(2) : 'N/A';
              return { ...s, gwa };
            });

            let cohortTotalUnits = 0;
            let cohortGradePoints = 0;
            let cohortPassedSubs = 0;
            let cohortTotalSubs = gradeRows.length;
            gradeRows.forEach(g => {
              const u = Number(g.units) || 3;
              const rawG = Number(g.grade);
              if (!isNaN(rawG) && rawG > 0) {
                cohortTotalUnits += u;
                cohortGradePoints += rawG * u;
                if (g.status === 'passed' || (rawG <= 3.0 && rawG >= 1.0) || rawG >= 75) {
                  cohortPassedSubs++;
                }
              } else if (g.status === 'passed') {
                cohortPassedSubs++;
              }
            });
            const cohortAverageGwa = cohortTotalUnits > 0 ? (cohortGradePoints / cohortTotalUnits).toFixed(2) : 'N/A';
            const cohortPassingRate = cohortTotalSubs > 0 ? `${Math.round((cohortPassedSubs / cohortTotalSubs) * 100)}%` : 'N/A';

            const dateStr = new Date().toISOString().slice(0, 10);
            const fileBaseName = `GCT_${programFileTag}_${yearFileTag}_ALL_GRADES_${dateStr}`;
            const gradesCsv = generateCohortGradesCsv(gradeRows, fileBaseName);

            fileExport = {
              filename: `${fileBaseName}.xlsx`,
              format: 'excel',
              csv_data: gradesCsv,
              data: gradesCsv,
              label: `Download ${programLabel} ${yearLabel} Complete Grade Records (${gradeRows.length} Entries) (Excel Spreadsheet)`
            };

            const gradesTableMarkdown = buildCohortGradesSummaryTableMarkdown(studentSummaries, 20);

            if (gradeRows.length > 0) {
              assistantResponse = userIsTagalog
                ? `### Opisyal na Talaan ng mga Marka (Grade Records)\n\n` +
                  `**Buod ng mga Marka ng Cohort:**\n` +
                  `- **Kurso / Programa:** **${programLabel}**\n` +
                  `- **Year Level:** **${yearLabel}**\n` +
                  `- **Kabuuang Estudyante:** **${studentSummaries.length}** estudyante (${gradeRows.length} grade entries)\n` +
                  `- **Average Cohort GWA:** **${cohortAverageGwa}**\n` +
                  `- **Passing Rate:** **${cohortPassingRate}** (${cohortPassedSubs} naipasang asignatura)\n\n` +
                  `#### Buod ng mga Marka ng mga Estudyante (Unang 20 rekord):\n` +
                  `${gradesTableMarkdown}\n` +
                  (studentSummaries.length > 20 ? `\n*... at ${studentSummaries.length - 20} pang mga estudyante sa database.*\n` : '\n') +
                  `\n---\n*Ang buong talaan ng mga marka ay mai-da-download bilang **Excel Spreadsheet** gamit ang button sa ibaba.*\n\n` +
                  `Nais mo bang makita ang mga inirerekomendang asignatura para sa susunod na semestre para sa cohort na ito, o i-filter ang mga may bagsak na subject?`
                : `### Official Student Grade Records Report\n\n` +
                  `**Cohort Academic Performance Overview:**\n` +
                  `- **Degree Program:** **${programLabel}**\n` +
                  `- **Year Level:** **${yearLabel}**\n` +
                  `- **Total Students with Grades:** **${studentSummaries.length}** students (${gradeRows.length} grade entries)\n` +
                  `- **Average Cohort GWA:** **${cohortAverageGwa}**\n` +
                  `- **Passing Rate:** **${cohortPassingRate}** (${cohortPassedSubs} subjects passed)\n\n` +
                  `#### Student Performance & GWA Summary (First 20 records):\n` +
                  `${gradesTableMarkdown}\n` +
                  (studentSummaries.length > 20 ? `\n*... and ${studentSummaries.length - 20} more students in the database.*\n` : '\n') +
                  `\n---\n*The complete grade records dataset has been exported and is ready to download as an **Excel Spreadsheet** using the download button below.*\n\n` +
                  `Would you like to view the recommended subjects for next semester for this cohort, or filter students with active deficiencies?`;
            } else {
              const rosterTable = buildStudentsTableMarkdown(filtered, 20);
              assistantResponse = userIsTagalog
                ? `### Talaan ng Marka: ${programLabel} — ${yearLabel}\n\n` +
                  `Kasalukuyang wala pang opisyal na encoded grade records sa database para sa partikular na cohort na ito.\n\n` +
                  `**Mga Rehistradong Estudyante (${filtered.length} students):**\n` +
                  `${rosterTable}\n\n` +
                  `*Maaari mong i-download ang roster sa Excel gamit ang button sa ibaba.*\n\n` +
                  `Nais mo bang makita ang curriculum subject recommendations para sa taong ito, o suriin ang ibang programa?`
                : `### Grade Records: ${programLabel} — ${yearLabel}\n\n` +
                  `There are currently no official encoded grade sheets on file for this specific cohort in the database.\n\n` +
                  `**Registered Students Roster (${filtered.length} students):**\n` +
                  `${rosterTable}\n\n` +
                  `*You can download the student roster in Excel using the button below.*\n\n` +
                  `Would you like to view the curriculum subject recommendations for this cohort instead?`;
            }

            systemPrompt = '';
          }
          // BRANCH C: STUDENT DIRECTORY / ROSTER
          else {
            const countY1 = filtered.filter(s => Number(s.year_level || s.year || 1) === 1).length;
            const countY2 = filtered.filter(s => Number(s.year_level || s.year || 1) === 2).length;
            const countY3 = filtered.filter(s => Number(s.year_level || s.year || 1) === 3).length;
            const countY4 = filtered.filter(s => Number(s.year_level || s.year || 1) === 4).length;

            const requestedFormat = detectRequestedFileFormat(query);
            const fileBaseName = `GCT_Students_${programFileTag}_${yearFileTag}_${Date.now()}`;
            let fileData = '';
            let filename = '';
            let fileLabel = '';

            if (requestedFormat === 'word') {
              fileData = generateStudentsListWord(filtered, `GCT Students Directory - ${programLabel} (${yearLabel})`);
              filename = `${fileBaseName}.doc`;
              fileLabel = `Download ${programLabel} ${yearLabel} (${filtered.length} Students) (Word Document)`;
            } else if (requestedFormat === 'text') {
              fileData = filtered.map(s => `${s.student_id || s.id}\t${s.full_name || s.name}\t${s.program || 'BSIT'}\tYear ${s.year_level || s.year || 1}\t${s.status || 'Active'}`).join('\n');
              filename = `${fileBaseName}.txt`;
              fileLabel = `Download ${programLabel} ${yearLabel} (${filtered.length} Students) (Text File)`;
            } else {
              fileData = generateStudentsListCsv(filtered, `GCT_Students_${programFileTag}_${yearFileTag}`);
              filename = `${fileBaseName}.csv`;
              fileLabel = `Download ${programLabel} ${yearLabel} (${filtered.length} Students) (Excel Spreadsheet)`;
            }

            fileExport = {
              filename,
              format: requestedFormat === 'word' || requestedFormat === 'text' ? requestedFormat : 'excel',
              csv_data: fileData,
              data: fileData,
              label: fileLabel
            };

            let programSummaryMarkdown = '';
            if (cohortFilter.isGroupByProgram || (!cohortFilter.program && cohortFilter.yearLevel === 'all')) {
              const programMap = new Map();
              for (const s of filtered) {
                const p = s.program || 'BSIT';
                const y = Number(s.year_level || s.year || 1);
                if (!programMap.has(p)) {
                  programMap.set(p, { y1: 0, y2: 0, y3: 0, y4: 0, total: 0 });
                }
                const entry = programMap.get(p);
                if (y === 1) entry.y1++;
                else if (y === 2) entry.y2++;
                else if (y === 3) entry.y3++;
                else if (y === 4) entry.y4++;
                entry.total++;
              }

              const progRows = Array.from(programMap.entries())
                .sort((a, b) => b[1].total - a[1].total)
                .map(([code, d]) => `| **${code}** | ${d.y1} | ${d.y2} | ${d.y3} | ${d.y4} | **${d.total}** |`);

              if (progRows.length > 0) {
                programSummaryMarkdown = [
                  userIsTagalog ? '#### Buod ng Estudyante Bawat Programa at Taon:' : '#### Program & Year Level Distribution Matrix:',
                  '| Degree Program | 1st Year | 2nd Year | 3rd Year | 4th Year | Total Students |',
                  '| :--- | :---: | :---: | :---: | :---: | :---: |',
                  ...progRows
                ].join('\n') + '\n\n';
              }
            }

            const rosterTableMarkdown = buildStudentsTableMarkdown(filtered, 20);

            if (userIsTagalog) {
              assistantResponse = `### Opisyal na Talaan ng mga Rekord ng Estudyante ng GCT\n\n` +
                `**Buod ng Hiniling na Talaan:**\n` +
                `- **Kabuuang Estudyante:** **${filtered.length}** rekord (mula sa kabuuang ${totalInDb} sa database)\n` +
                `- **Filter ng Programa:** **${programLabel}**\n` +
                `- **Filter ng Year Level:** **${yearLabel}**\n` +
                `- **Distribusyon sa Bawat Taon:** 1st Year: **${countY1}** | 2nd Year: **${countY2}** | 3rd Year: **${countY3}** | 4th Year: **${countY4}**\n\n` +
                programSummaryMarkdown +
                `#### Talaan ng mga Estudyante (Unang 20 rekord):\n` +
                `${rosterTableMarkdown}\n` +
                (filtered.length > 20 ? `\n*... at ${filtered.length - 20} pang mga estudyante sa database.*\n` : '\n') +
                `\n---\n*Ang buong talaan ng **${filtered.length}** na estudyante ay handa nang i-download bilang **Excel Spreadsheet** gamit ang download button sa ibaba.*\n\n` +
                `Nais mo bang i-filter ang mga estudyante ayon sa partikular na kurso, o suriin ang rekord ng isang partikular na Student ID?`;
            } else {
              assistantResponse = `### GCT Official Student Academic Records Directory\n\n` +
                `**Directory Report Overview:**\n` +
                `- **Total Matching Records:** **${filtered.length}** students (out of ${totalInDb} registered in database)\n` +
                `- **Academic Program Filter:** **${programLabel}**\n` +
                `- **Year Level Filter:** **${yearLabel}**\n` +
                `- **Year Level Distribution:** 1st Year: **${countY1}** | 2nd Year: **${countY2}** | 3rd Year: **${countY3}** | 4th Year: **${countY4}**\n\n` +
                programSummaryMarkdown +
                `#### Student Roster (First 20 records):\n` +
                `${rosterTableMarkdown}\n` +
                (filtered.length > 20 ? `\n*... and ${filtered.length - 20} more students in the database.*\n` : '\n') +
                `\n---\n*The complete dataset of **${filtered.length}** students has been exported and is ready to download as an **Excel Spreadsheet** using the download button below.*\n\n` +
                `Would you like to filter these records by a specific degree program, or inspect the academic evaluation of an individual Student ID?`;
            }

            systemPrompt = '';
          }
        }
      }
      // 3. SINGLE-STUDENT or GENERAL QUERY
      else {
        const targetStudent = multiStudents.length === 1 ? multiStudents[0] : await findTargetStudent(query, db, history);

        if (targetStudent) {
          // Specific student found! Fetch their full records and generate requested file format
          const { records, recommendations } = await getStudentRecordsAndRecs(targetStudent, db);
          const cleanId = String(targetStudent.student_id || targetStudent.id || 'Student').replace(/^GCT-/i, '').trim();
          const termAnalysis = extractTargetTermAndSemester(query, targetStudent.year_level || targetStudent.year);

          let activeAcademicYear = '2026-2027';
          try {
            const { data: sData } = await db.from('settings').select('key, value').in('key', ['activeAcademicYear', 'active_academic_year']);
            if (sData?.[0]?.value) activeAcademicYear = String(sData[0].value).trim();
          } catch (e) { }

          const enrollmentStatus = getStudentEnrollmentStatus(targetStudent, records, activeAcademicYear);

          // Classify user intent
          const isAssessmentQuery = /\b(assess|assessment|evaluat(?:e|ion)|pagsusuri|comprehensive|full\s+report|overall\s+standing|standing\s+assessment)\b/i.test(query);
          const isRecQuery = (/(?:subject\s+)?recommend(?:ation|ed|ing)?s?|subjects?\s+to\s+take|what\s+subjects?|curriculum\s+load|course\s+load|anong\s+(?:mga\s+)?kukunin/i.test(query)) && !isAssessmentQuery;
          const isGradesOnlyQuery = /\b(?:grades?|marka|score|rating|transcript|talaan(?:\s+ng\s+marka)?|records?|academic\s+records?|record\s+ng\s+marka)\b/i.test(query) && !isRecQuery && !isAssessmentQuery;

          // Check if user explicitly asked for all terms
          const isExplicitAllTerms = /\b(?:all|lahat|entire|complete|buo(?:ng)?|cumulative|tor|transcript\s+of\s+records|all\s+terms?|lahat\s+ng\s+termino)\b/i.test(query);

          // Check if this turn is a follow-up answer to a prior prompt asking which term's grades they want
          const lastBotTurn = Array.isArray(history) && history.length > 0
            ? history.filter(h => (h.sender !== 'user' && h.role !== 'user') && (h.text || h.content)).slice(-1)[0]
            : null;
          const lastBotText = String(lastBotTurn?.text || lastBotTurn?.content || '');
          const lastUserTurn = Array.isArray(history) && history.length > 0
            ? history.filter(h => (h.sender === 'user' || h.role === 'user') && (h.text || h.content)).slice(-1)[0]
            : null;
          const lastUserText = String(lastUserTurn?.text || lastUserTurn?.content || '');

          const recentBotTurns = Array.isArray(history) && history.length > 0
            ? history.filter(h => (h.sender !== 'user' && h.role !== 'user') && (h.text || h.content)).slice(-3)
            : [];
          const isFollowUpToGradesPrompt = !isAssessmentQuery && (
            lastBotTurn?.pending_action === 'clarify_grades_term' ||
            recentBotTurns.some(b =>
              b.pending_action === 'clarify_grades_term' ||
              /which academic term.*grades|aling academic year o semestre.*marka|aling termino.*marka|recorded terms available on file|mga nakatalang termino|Select term to view grades/i.test(b.text || b.content || '') ||
              /Official Academic Record & Grade Sheet|Opisyal na Talaan ng Marka|Academic Record & Grade Sheet|Grade Sheet/i.test(b.text || b.content || '')
            ) ||
            (/\b(?:grades?|marka|records?)\b/i.test(lastUserText) && !/(?:subject\s+)?recommend/i.test(lastUserText))
          );

          const effectiveGradesQuery = !isAssessmentQuery && (isGradesOnlyQuery || (isFollowUpToGradesPrompt && !isRecQuery));

          // 🔒 FOLLOW-UP CLARIFICATION QUESTION:
          // When the user asks for a student's grades without specifying which term, DO NOT dump all grades immediately!
          // Ask which academic year or semester they want, presenting recorded terms on file.
          if (effectiveGradesQuery && !termAnalysis.isSpecificFilter && !isExplicitAllTerms) {
            const distinctTerms = getDistinctTermsList(records);
            if (records.length === 0) {
              const noGradesMsg = userIsTagalog
                ? `Walang natagpuang rekord ng nakaraang marka para kay **${targetStudent.name || targetStudent.full_name}** (\`${cleanId}\`) sa opisyal na database.\n\n` +
                `Nais ninyo bang tingnan ang kanyang **Inirerekomendang mga Asignatura (Subject Recommendations)** para sa enrollment?\n\n` +
                `*Maaari ninyong i-type ang "Subject Recommendations" o gamitin ang action buttons sa ibaba.*`
                : `No recorded past grades found on file for **${targetStudent.name || targetStudent.full_name}** (\`${cleanId}\`) in the official database.\n\n` +
                `Would you like to review their **Subject Recommendations** for the upcoming semester instead?\n\n` +
                `*Please reply with "Subject Recommendations" or use the action buttons below.*`;
              return res.json({
                id: 'chat-' + Date.now(),
                query,
                response: noGradesMsg,
                role: userRole,
                timestamp: new Date().toISOString(),
                file_export: null,
                student_action: {
                  student_id: targetStudent.student_id,
                  student_name: targetStudent.name || targetStudent.full_name,
                  program: targetStudent.program,
                  pending_action: 'recommendation_offer',
                  available_terms: ['Subject Recommendations']
                },
                follow_up_questions: [
                  `Subject recommendations for ${cleanId}`,
                  `Academic Records for ${cleanId}`
                ]
              });
            }

            const termsListMarkdown = distinctTerms.map(t => `- **${t.displayLabel}**`).join('\n');
            const followUpResponse = userIsTagalog
              ? `Aling academic year o semestre ang nais ninyong makitang marka para kay **${targetStudent.name || targetStudent.full_name}** (\`${cleanId}\`)?\n\n` +
              `**Mga nakatalang termino sa kanyang academic records:**\n` +
              `${termsListMarkdown}\n` +
              `- **Lahat ng Termino (All Terms / Cumulative Summary)**\n\n` +
              `*Pakisabi kung aling termino (halimbawa: "${distinctTerms[0]?.term || '1st Sem'}" o "Lahat") ang nais ninyong suriin.*`
              : `Which academic term or semester's grades would you like to review for **${targetStudent.name || targetStudent.full_name}** (\`${cleanId}\`)?\n\n` +
              `**Recorded terms available on file for this student:**\n` +
              `${termsListMarkdown}\n` +
              `- **All Terms / Cumulative Grade Sheet**\n\n` +
              `*Please reply with your preferred term (for example: "${distinctTerms[0]?.term || '1st Sem'}" or "All Terms") to view the official grade sheet.*`;

            return res.json({
              id: 'chat-' + Date.now(),
              query,
              response: followUpResponse,
              role: userRole,
              timestamp: new Date().toISOString(),
              file_export: null,
              student_action: {
                student_id: targetStudent.student_id,
                student_name: targetStudent.name || targetStudent.full_name,
                program: targetStudent.program,
                pending_action: 'clarify_grades_term',
                available_terms: distinctTerms.map(t => t.term)
              },
              follow_up_questions: distinctTerms.map(t => t.displayLabel).concat(userIsTagalog ? ['Lahat ng Termino'] : ['All Terms'])
            });
          }

          // Check if user requested a specific year level and/or semester (e.g. "2nd year 1st sem")
          let displayRecords = records;
          let isFilteredByTerm = false;
          let termLabelClean = '';

          if (termAnalysis.isSpecificFilter) {
            const filterYear = termAnalysis.academic_year ? termAnalysis.explicitYear : termAnalysis.year;
            const matching = records.filter(r => matchesRecordTerm(r, filterYear, termAnalysis.semester, termAnalysis.academic_year));
            if (matching.length > 0) {
              displayRecords = matching;
              isFilteredByTerm = true;
              termLabelClean = termAnalysis.target_term ? termAnalysis.target_term.replace(/[^a-zA-Z0-9]+/g, '_') : 'Term';
            } else if (effectiveGradesQuery) {
              // ONLY bail out with "No recorded grades" IF the query was EXCLUSIVELY asking for past grades in that term!
              const availableTerms = Array.from(new Set(records.map(r => r.term).filter(Boolean))).join(', ');
              const noTermMsg = userIsTagalog
                ? `Walang natagpuang rekord o marka para kay **${targetStudent.name || targetStudent.full_name}** (${cleanId}) para sa **${termAnalysis.target_term || 'hiniling na termino'}** sa opisyal na database.\n\n` +
                (availableTerms ? `Mga nakatalang termino sa database para sa estudyanteng ito: **${availableTerms}**.\n\n*Gamitin ang action button sa ibaba upang buksan ang buong Academic Records ng estudyante.*\n\nNais mo bang tingnan ang kanyang mga marka sa isa sa mga nakatalang termino sa itaas, o kalkulahin ang kanyang subject recommendations para sa susunod na semestre?` : `Nais mo bang kalkulahin ang kanyang mga inirerekomendang asignatura para sa susunod na termino?`)
                : `No recorded grades found for **${targetStudent.name || targetStudent.full_name}** (${cleanId}) for **${termAnalysis.target_term || 'the requested term'}** in the official database.\n\n` +
                (availableTerms ? `Recorded terms available on file: **${availableTerms}**.\n\n*Use the action button below to open the student's full Academic Records.*\n\nWould you like to view their grades for one of the available terms above, or compute their subject recommendations for the upcoming semester?` : `Would you like to compute their subject recommendations for the upcoming semester?`);

              return res.json({
                id: 'chat-' + Date.now(),
                query,
                response: noTermMsg,
                role: userRole,
                timestamp: new Date().toISOString(),
                file_export: null,
                student_action: {
                  student_id: targetStudent.student_id,
                  student_name: targetStudent.name || targetStudent.full_name,
                  program: targetStudent.program,
                  target_term: termAnalysis.target_term || undefined,
                  semester: termAnalysis.semester || undefined,
                  year_level: termAnalysis.year || undefined
                },
                follow_up_questions: [
                  `Subject recommendations for ${cleanId}`,
                  `Academic Records for ${cleanId}`
                ]
              });
            }
          }

          const { totalUnits, passedUnits, failedUnits, passedCount, failedCount, gwa } = calculateStudentStats(displayRecords);

          // Run official deterministic Assessment Engine (with target term override if user requested a specific term for recommendation)
          const targetTermOverride = (isRecQuery && termAnalysis.isSpecificFilter)
            ? { year: termAnalysis.year, semester: termAnalysis.semester }
            : null;
          const evalData = await getStudentEvaluationData(targetStudent, records, db, targetTermOverride);
          const { recommendedSubjects, activeDeficiencies, targetTerm, totalRecommendedUnits } = evalData;
          const targetTermText = formatTargetTermText(targetTerm?.year_level, targetTerm?.semester);

          let queryIntent = 'comprehensive';
          if (isAssessmentQuery) {
            queryIntent = 'comprehensive';
          } else if (isRecQuery) {
            queryIntent = 'recommendation';
          } else if (effectiveGradesQuery) {
            queryIntent = 'grades';
          } else {
            queryIntent = classifyStudentQueryIntent(query);
          }

          const csvOptions = {
            intent: queryIntent,
            recommendedSubjects,
            activeDeficiencies,
            targetTermText,
            totalRecommendedUnits,
            enrollmentStatus,
            isFilteredByTerm,
            termLabel: termAnalysis.target_term || (isFilteredByTerm ? termLabelClean : 'All Encoded Terms'),
            stats: { totalUnits, passedUnits, failedUnits, passedCount, failedCount, gwa }
          };

          // Detect requested file format (word, excel, text, pdf)
          const requestedFormat = detectRequestedFileFormat(query);
          let fileData = '';
          let filename = '';
          let fileLabel = '';

          if (requestedFormat === 'word') {
            fileData = generateStudentWord(targetStudent, displayRecords, gwa, csvOptions);
            if (queryIntent === 'recommendation') {
              filename = `${cleanId}_Subject_Recommendations_${termLabelClean || 'Upcoming'}.doc`;
              fileLabel = `Download ${cleanId} Subject Recommendations (${targetTermText}) (Word Document)`;
            } else if (queryIntent === 'grades') {
              filename = `${cleanId}_Grade_Sheet${isFilteredByTerm ? `_${termLabelClean}` : '_All_Terms'}.doc`;
              fileLabel = `Download ${cleanId} Grade Sheet${isFilteredByTerm ? ` (${termAnalysis.target_term})` : ' (All Terms)'} (Word Document)`;
            } else {
              filename = `${cleanId}_Academic_Evaluation_Report.doc`;
              fileLabel = `Download ${cleanId} Academic Report & Recommendations (Word Document)`;
            }
          } else if (requestedFormat === 'text') {
            fileData = generateStudentText(targetStudent, displayRecords, gwa, csvOptions);
            if (queryIntent === 'recommendation') {
              filename = `${cleanId}_Subject_Recommendations_${termLabelClean || 'Upcoming'}.txt`;
              fileLabel = `Download ${cleanId} Subject Recommendations (${targetTermText}) (Text File)`;
            } else if (queryIntent === 'grades') {
              filename = `${cleanId}_Grade_Sheet${isFilteredByTerm ? `_${termLabelClean}` : '_All_Terms'}.txt`;
              fileLabel = `Download ${cleanId} Grade Sheet${isFilteredByTerm ? ` (${termAnalysis.target_term})` : ' (All Terms)'} (Text File)`;
            } else {
              filename = `${cleanId}_Academic_Evaluation_Report.txt`;
              fileLabel = `Download ${cleanId} Academic Report & Recommendations (Text File)`;
            }
          } else {
            fileData = generateStudentCsv(targetStudent, displayRecords, gwa, csvOptions);
            if (queryIntent === 'recommendation') {
              filename = `${cleanId}_Subject_Recommendations_${termLabelClean || 'Upcoming'}.csv`;
              fileLabel = `Download ${cleanId} Subject Recommendations (${targetTermText}) (Excel Spreadsheet)`;
            } else if (queryIntent === 'grades') {
              filename = `${cleanId}_Grade_Sheet${isFilteredByTerm ? `_${termLabelClean}` : '_All_Terms'}.csv`;
              fileLabel = `Download ${cleanId} Grade Sheet${isFilteredByTerm ? ` (${termAnalysis.target_term})` : ' (All Terms)'} (Excel Spreadsheet)`;
            } else {
              filename = `${cleanId}_Academic_Evaluation_Report.csv`;
              fileLabel = `Download ${cleanId} Academic Report & Recommendations (Excel Spreadsheet)`;
            }
          }

          fileExport = {
            filename,
            format: requestedFormat,
            csv_data: fileData,
            data: fileData,
            label: fileLabel
          };

          studentAction = {
            student_id: targetStudent.student_id,
            student_name: targetStudent.name || targetStudent.full_name,
            program: targetStudent.program,
            intent: queryIntent,
            target_term: targetTermText || termAnalysis.target_term || undefined,
            semester: (targetTerm?.semester != null ? String(targetTerm.semester) : (termAnalysis.semester || undefined)),
            year_level: targetTerm?.year_level || termAnalysis.year || undefined,
            recommended_semester: (targetTerm?.semester != null ? String(targetTerm.semester) : undefined),
            recommended_year_level: targetTerm?.year_level || undefined,
            recommended_target_term: targetTermText || undefined
          };

          const gradesTableMarkdown = buildGradesTableMarkdown(displayRecords);
          const recommendationsTableMarkdown = buildRecommendationsTableMarkdown(recommendedSubjects);
          const deficienciesTableMarkdown = buildDeficienciesTableMarkdown(activeDeficiencies);
          const narrativeExplanation = generateNarrativeExplanation({
            student: targetStudent,
            stats: { totalUnits, passedUnits, failedUnits, passedCount, failedCount, gwa },
            targetTermText,
            recommendedSubjects,
            activeDeficiencies,
            totalRecommendedUnits,
            isTagalog: userIsTagalog,
            intent: queryIntent
          });

          const studentDisplayName = targetStudent.name || targetStudent.full_name || 'Student';
          const studentYearText = targetStudent.year_level || targetStudent.year || 1;

          if (queryIntent === 'grades') {
            systemPrompt = `You are the official GCT Registrar Operations AI Assistant for Garcia College of Technology.
User: ${userName} (Registrar Operations)
Student Name: ${studentDisplayName}
Student ID: ${targetStudent.student_id}
Program: ${targetStudent.program} - Year ${studentYearText}
Enrollment Status: ${enrollmentStatus.statusLabel}
Cumulative GWA: ${gwa}
Passed: ${passedUnits} units (${passedCount} subjects)
Deficiencies: ${failedCount} units (${failedCount} subjects)
${enrollmentStatus.isStoppedOrLapsed ? `ENROLLMENT GAP NOTICE: Student was last enrolled in ${enrollmentStatus.lastEnrolledTerm} and is currently inactive/stopped.` : ''}
${isFilteredByTerm ? `TERM FILTER NOTICE: The user explicitly requested records for "${termAnalysis.target_term}". When discussing grades, focus strictly on "${termAnalysis.target_term}".` : ''}

OFFICIAL EVALUATION DATA (GROUND TRUTH FROM GCT ASSESSMENT ENGINE):
---
Official Grade Sheet Table (${isFilteredByTerm ? termAnalysis.target_term : 'All Encoded Terms'}):
${gradesTableMarkdown}

Active Deficiencies Table:
${deficienciesTableMarkdown || 'None (Clean academic standing)'}
---

CRITICAL INTENT AND EXCLUSION DIRECTIVE (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY DO NOT INCLUDE SUBJECT RECOMMENDATIONS:
   - The user asked ONLY for the student's academic record / grade sheet (${isFilteredByTerm ? `for "${termAnalysis.target_term}"` : 'for encoded terms on file'}).
   - DO NOT include, list, advise, or recommend upcoming subjects or future courses to enroll in.
   - DO NOT output any Recommended Subjects table or future curriculum advising load, because the user did not ask for recommendations.
   - Present ONLY the requested grade sheet, active deficiencies (if any), and a concise narrative of past academic performance.
2. ABSOLUTELY NO MEMORANDUM FORMAT:
   - Under NO circumstance should you output "MEMORANDUM", "MEMO", "TO:", "FROM:", "DATE:", "SUBJECT:", or numbered institutional memo titles.
   - Do NOT format this as an internal memorandum or bureaucratic document.
3. MANDATORY MARKDOWN TABLES:
   - When presenting grades, you MUST format them as a Markdown table with columns: | Subject Code | Description | Units | Grade | Status | Academic Term |
   - When presenting active deficiencies, use a Markdown table with columns: | Subject Code | Description | Units | Grade | Status | Term Recorded |
   - NEVER present course lists or grades as sentences or run-on paragraphs. Tables are strictly required.
4. CLEAR NARRATIVE EXPLANATION:
   - Accompany the tables with a concise, professional narrative explanation summarizing academic performance and standing for the requested term/records.
5. ACCURACY AND FACTUAL GROUNDING:
   - Strictly use ONLY the exact subjects, codes, titles, and units provided in the official grade sheet table above. Do NOT hallucinate course codes.
6. ZERO EMOJIS:
   - Do NOT include any emojis or decorative smiley symbols.
7. PRIMARY LANGUAGE DIRECTIVE:
   - Default language is English. If the user's message is in Tagalog (userIsTagalog = ${userIsTagalog}), respond in fluent, natural Tagalog.

USER MESSAGE: "${query}"

Instructions:
- Directly, professionally, and accurately present ONLY the requested official grade sheet / academic records for this student.
- DO NOT generate or output any recommended subjects table.
- Confirm that their requested ${requestedFormat.toUpperCase()} file has been generated and is ready to download below.
- Note that interactive buttons below can open this student's profile directly in Academic Records.
- MANDATORY FOLLOW-UP QUESTION RULE: Always conclude with an engaging follow-up question (e.g. asking if they want to calculate subject recommendations for next term, review prerequisites, or check graduation standing).`;
          } else if (queryIntent === 'recommendation') {
            systemPrompt = `You are the official GCT Registrar Operations AI Assistant for Garcia College of Technology.
User: ${userName} (Registrar Operations)
Student Name: ${studentDisplayName}
Student ID: ${targetStudent.student_id}
Program: ${targetStudent.program} - Year ${studentYearText}
Enrollment Status: ${enrollmentStatus.statusLabel}
Cumulative GWA: ${gwa}
Passed: ${passedUnits} units (${passedCount} subjects)
Deficiencies: ${failedCount} units (${failedCount} subjects)
Target Advising Term: ${targetTermText} (${totalRecommendedUnits} recommended units)
${enrollmentStatus.isStoppedOrLapsed ? `ENROLLMENT GAP NOTICE: Student was last enrolled in ${enrollmentStatus.lastEnrolledTerm} and is currently inactive/stopped. Note this when providing advising.` : ''}

OFFICIAL EVALUATION DATA (GROUND TRUTH FROM GCT ASSESSMENT ENGINE - DO NOT INVENT SUBJECTS):
---
Official Recommended Subjects Table:
${recommendationsTableMarkdown}

Active Deficiencies Table:
${deficienciesTableMarkdown || 'None (Clean academic standing)'}
---

CRITICAL FORMATTING INSTRUCTIONS (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY NO MEMORANDUM FORMAT:
   - Under NO circumstance should you output "MEMORANDUM", "MEMO", "TO:", "FROM:", "DATE:", "SUBJECT:", or numbered institutional memo titles.
   - Do NOT format this as an internal memorandum.
2. MANDATORY MARKDOWN TABLES:
   - When presenting subject recommendations, you MUST format them as a Markdown table with columns: | Subject Code | Description | Units | Classification | Prerequisites / Notes |
   - When presenting active deficiencies, use a Markdown table with columns: | Subject Code | Description | Units | Grade | Status | Term Recorded |
   - NEVER present course lists as sentences or run-on paragraphs. Tables are strictly required.
3. CLEAR NARRATIVE EXPLANATION:
   - Accompany the tables with a concise, professional narrative explanation summarizing prerequisite compliance and advising guidance for ${targetTermText}.
4. ACCURACY AND FACTUAL GROUNDING:
   - Strictly use ONLY the exact subjects, codes, titles, and units provided in the official evaluation tables above. Do NOT hallucinate course codes or modify prerequisites.
5. ZERO EMOJIS:
   - Do NOT include any emojis or decorative smiley symbols.
6. PRIMARY LANGUAGE DIRECTIVE:
   - Default language is English. If the user's message is in Tagalog (userIsTagalog = ${userIsTagalog}), respond in fluent, natural Tagalog.

USER MESSAGE: "${query}"

Instructions:
- Directly, professionally, and accurately reply with the official subject recommendations for ${targetTermText}.
- Confirm that their requested ${requestedFormat.toUpperCase()} file has been generated and is ready to download below.
- Note that interactive buttons below will open this student's profile directly in Academic Records or Subject Recommendations.
- MANDATORY FOLLOW-UP QUESTION RULE: Always conclude with an engaging follow-up question (e.g. asking if they want to view the student's complete grade sheet, check active deficiencies, or evaluate graduation eligibility).`;
          } else {
            // Comprehensive / default (only when user explicitly asked for both or general evaluation)
            systemPrompt = `You are the official GCT Registrar Operations AI Assistant for Garcia College of Technology.
User: ${userName} (Registrar Operations)
Student Name: ${studentDisplayName}
Student ID: ${targetStudent.student_id}
Program: ${targetStudent.program} - Year ${studentYearText}
Enrollment Status: ${enrollmentStatus.statusLabel}
Cumulative GWA: ${gwa}
Passed: ${passedUnits} units (${passedCount} subjects)
Deficiencies: ${failedCount} units (${failedCount} subjects)
Target Advising Term: ${targetTermText} (${totalRecommendedUnits} recommended units)
${enrollmentStatus.isStoppedOrLapsed ? `ENROLLMENT GAP NOTICE: Student was last enrolled in ${enrollmentStatus.lastEnrolledTerm} and is currently inactive/stopped. Note this when providing advising.` : ''}
${isFilteredByTerm ? `TERM FILTER NOTICE: The user explicitly requested records for "${termAnalysis.target_term}". When discussing grades, focus strictly on "${termAnalysis.target_term}".` : ''}

OFFICIAL EVALUATION DATA (GROUND TRUTH FROM GCT ASSESSMENT ENGINE - DO NOT INVENT SUBJECTS):
---
Official Grade Sheet Table (${isFilteredByTerm ? termAnalysis.target_term : 'All Encoded Terms'}):
${gradesTableMarkdown}

Official Recommended Subjects Table (${targetTermText}):
${recommendationsTableMarkdown}

Active Deficiencies Table:
${deficienciesTableMarkdown || 'None (Clean academic standing)'}
---

CRITICAL FORMATTING INSTRUCTIONS (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY NO MEMORANDUM FORMAT:
   - Under NO circumstance should you output "MEMORANDUM", "MEMO", "TO:", "FROM:", "DATE:", "SUBJECT:", or numbered institutional memo titles.
   - Do NOT format this as an internal memorandum or bureaucratic document.
2. MANDATORY MARKDOWN TABLES:
   - When presenting subject recommendations, you MUST format them as a Markdown table with columns: | Subject Code | Description | Units | Classification | Prerequisites / Notes |
   - When presenting grades, you MUST format them as a Markdown table with columns: | Subject Code | Description | Units | Grade | Status | Academic Term |
   - When presenting active deficiencies, use a Markdown table with columns: | Subject Code | Description | Units | Grade | Status | Term Recorded |
   - NEVER present course lists or grades as sentences or run-on paragraphs. Tables are strictly required.
3. CLEAR NARRATIVE EXPLANATION:
   - Always accompany the tables with a concise, professional narrative explanation summarizing academic performance, enrollment timeline (last enrolled term), prerequisite compliance, and official advising guidance.
4. ACCURACY AND FACTUAL GROUNDING:
   - Strictly use ONLY the exact subjects, codes, titles, and units provided in the official evaluation tables above. Do NOT hallucinate course codes or modify prerequisites.
5. ZERO EMOJIS:
   - Do NOT include any emojis or decorative smiley symbols.
6. PRIMARY LANGUAGE DIRECTIVE:
   - Default language is English. If the user's message is in Tagalog (userIsTagalog = ${userIsTagalog}), respond in fluent, natural Tagalog.

USER MESSAGE: "${query}"

Instructions:
- The user requested an assessment of the student. You MUST present BOTH the Official Grade Sheet Table (displaying all encoded grades on file across all terms) AND the Official Recommended Subjects Table for the upcoming advising term (${targetTermText}).
- Accompany the tables with active deficiencies (if any) and a comprehensive advising evaluation narrative.
- Confirm that their requested ${requestedFormat.toUpperCase()} file has been generated and is ready to download below.
- Note that interactive buttons below will open this student's profile directly in Academic Records or Subject Recommendations.
- MANDATORY FOLLOW-UP QUESTION RULE: Always conclude with an engaging follow-up question (e.g. asking if they want to review prerequisite progression in detail, download in Excel, or verify graduation clearance).`;
          }

          if (queryIntent === 'recommendation') {
            assistantResponse = userIsTagalog
              ? `### Rekomendasyon sa Asignatura at Pagsusuri: **${studentDisplayName}**\n\n**Profile ng Estudyante:**\n- **Student ID:** \`${cleanId}\`\n- **Program & Taon:** ${targetStudent.program} — Year ${studentYearText}\n- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Target na Termino ng Advising:** **${targetTermText}** (${totalRecommendedUnits} Units)\n${enrollmentStatus.isStoppedOrLapsed ? `\n> ⚠️ **Paunawa sa Enrollment:** May patlang sa enrollment ang estudyante (huling pumasok noong **${enrollmentStatus.lastEnrolledTerm}**).\n` : ''}\n#### Inirerekomendang mga Asignatura (${targetTermText} • ${totalRecommendedUnits} Units):\n${recommendationsTableMarkdown}\n\n${activeDeficiencies.length > 0 ? `#### Mga Aktibong Deficiency (Kailangang I-retake):\n${deficienciesTableMarkdown}\n\n` : ''}#### Opisyal na Pagsusuri at Gabay ng Registrar:\n${narrativeExplanation}\n\n---\n*Gamitin ang action buttons sa ibaba upang i-download ang rekord bilang ${requestedFormat.toUpperCase()} file, o buksan ang profile sa Academic Records o Subject Recommendations.*\n\nNais mo bang suriin ang buong talaan ng nakaraang marka ng estudyanteng ito, o buksan ang profile sa Subject Recommendations?`
              : `### Subject Recommendations & Academic Evaluation: **${studentDisplayName}**\n\n**Student Profile:**\n- **Student ID:** \`${cleanId}\`\n- **Program & Year:** ${targetStudent.program} — Year ${studentYearText}\n- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n- **Cumulative GWA:** **${gwa}**\n- **Passed Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Target Advising Term:** **${targetTermText}** (${totalRecommendedUnits} Total Units)\n${enrollmentStatus.isStoppedOrLapsed ? `\n> ⚠️ **Enrollment Notice:** Student has an enrollment gap (last attended **${enrollmentStatus.lastEnrolledTerm}**).\n` : ''}\n#### Recommended Subjects for ${targetTermText} (${totalRecommendedUnits} Units):\n${recommendationsTableMarkdown}\n\n${activeDeficiencies.length > 0 ? `#### Active Subject Deficiencies (Retake Required):\n${deficienciesTableMarkdown}\n\n` : ''}#### Academic Evaluation & Advising Explanation:\n${narrativeExplanation}\n\n---\n*Use the action buttons below to download the official record (${requestedFormat.toUpperCase()}) or open this profile in Academic Records / Subject Recommendations.*\n\nWould you like to inspect this student's full historical grade sheet, or open their profile directly in Subject Recommendations?`;
          } else if (queryIntent === 'grades') {
            assistantResponse = userIsTagalog
              ? `### Opisyal na Talaan ng Marka${isFilteredByTerm ? ` (${termAnalysis.target_term})` : ''}: **${studentDisplayName}**\n\n**Profile ng Estudyante:**\n- **Student ID:** \`${cleanId}\`\n- **Program & Taon:** ${targetStudent.program} — Year ${studentYearText}\n- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n- **GWA (${isFilteredByTerm ? termAnalysis.target_term : 'Cumulative'}):** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Deficiencies:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Standing)'}**\n\n#### Talaan ng mga Marka (${isFilteredByTerm ? termAnalysis.target_term : 'Lahat ng Termino'}):\n${gradesTableMarkdown}\n\n${activeDeficiencies.length > 0 ? `#### Mga Aktibong Deficiency:\n${deficienciesTableMarkdown}\n\n` : ''}#### Pagsusuri sa Academic Standing:\n${narrativeExplanation}\n\n---\n*Gamitin ang action buttons sa ibaba upang i-download ang rekord bilang ${requestedFormat.toUpperCase()} file, o buksan ang profile sa Academic Records.*\n\nNais mo bang kalkulahin ang kanyang mga inirerekomendang asignatura para sa susunod na termino, o suriin ang graduation eligibility?`
              : `### Official Academic Record & Grade Sheet${isFilteredByTerm ? ` (${termAnalysis.target_term})` : ''}: **${studentDisplayName}**\n\n**Student Profile:**\n- **Student ID:** \`${cleanId}\`\n- **Program & Year:** ${targetStudent.program} — Year ${studentYearText}\n- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n- **GWA (${isFilteredByTerm ? termAnalysis.target_term : 'Cumulative'}):** **${gwa}**\n- **Completed Units:** **${passedUnits}** units (${passedCount} passed)\n- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Standing)'}**\n\n#### Grade Sheet (${isFilteredByTerm ? termAnalysis.target_term : 'All Encoded Terms'}):\n${gradesTableMarkdown}\n\n${activeDeficiencies.length > 0 ? `#### Active Deficiencies:\n${deficienciesTableMarkdown}\n\n` : ''}#### Academic Performance Evaluation & Explanation:\n${narrativeExplanation}\n\n---\n*Use the action buttons below to download this record as a ${requestedFormat.toUpperCase()} file, or view the student in Academic Records.*\n\nWould you like me to compute their subject recommendations for the upcoming term, or evaluate their graduation prerequisite standing?`;
          } else {
            // Comprehensive / assessment
            assistantResponse = userIsTagalog
              ? `### Pagsusuri sa Academic Record at Rekomendasyon: **${studentDisplayName}**\n\n**Profile ng Estudyante:**\n- **Student ID:** \`${cleanId}\`\n- **Program & Taon:** ${targetStudent.program} — Year ${studentYearText}\n- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Deficiencies:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Standing)'}**\n- **Target na Termino ng Advising:** **${targetTermText}** (${totalRecommendedUnits} Units)\n${enrollmentStatus.isStoppedOrLapsed ? `\n> ⚠️ **Paunawa sa Enrollment:** May patlang sa enrollment ang estudyante (huling pumasok noong **${enrollmentStatus.lastEnrolledTerm}**).\n` : ''}\n#### Buong Talaan ng Marka (${isFilteredByTerm ? termAnalysis.target_term : 'Lahat ng Termino'}):\n${gradesTableMarkdown}\n\n#### Inirerekomendang mga Asignatura (${targetTermText} • ${totalRecommendedUnits} Units):\n${recommendationsTableMarkdown}\n\n${activeDeficiencies.length > 0 ? `#### Mga Aktibong Deficiency (Kailangang I-retake):\n${deficienciesTableMarkdown}\n\n` : ''}#### Opisyal na Pagsusuri at Gabay ng Registrar:\n${narrativeExplanation}\n\n---\n*Gamitin ang buttons sa ibaba upang i-download ang opisyal na ulat (${requestedFormat.toUpperCase()}) o buksan ang profile sa Academic Records o Subject Recommendations.*`
              : `### Academic Assessment & Recommendations: **${studentDisplayName}**\n\n**Student Profile:**\n- **Student ID:** \`${cleanId}\`\n- **Program & Year:** ${targetStudent.program} — Year ${studentYearText}\n- **Enrollment Status:** **${enrollmentStatus.statusLabel}**\n- **Cumulative GWA:** **${gwa}**\n- **Completed Units:** **${passedUnits}** units passed | **${failedCount} deficiencies**\n- **Target Advising Term:** **${targetTermText}** (${totalRecommendedUnits} Units Recommended)\n${enrollmentStatus.isStoppedOrLapsed ? `\n> ⚠️ **Enrollment Notice:** Student has an enrollment gap (last attended **${enrollmentStatus.lastEnrolledTerm}**).\n` : ''}\n#### Academic Grade Sheet (${isFilteredByTerm ? termAnalysis.target_term : 'All Encoded Terms'}):\n${gradesTableMarkdown}\n\n#### Recommended Subjects for Upcoming Term (${targetTermText} • ${totalRecommendedUnits} Units):\n${recommendationsTableMarkdown}\n\n${activeDeficiencies.length > 0 ? `#### Active Deficiencies (Retakes Required):\n${deficienciesTableMarkdown}\n\n` : ''}#### Academic Standing & Advising Summary:\n${narrativeExplanation}\n\n---\n*Use the action buttons below to download the report as a ${requestedFormat.toUpperCase()} file, or open this profile directly in Academic Records or Subject Recommendations.*`;
          }
        }
        // General institutional inquiry
        else {
          const { data: stData } = await db.from('students').select('id, student_id, full_name, program, year_level, status');
          const allStudents = stData || [];
          const studentCount = allStudents.length;

          const { data: acctData } = await db.from('accounts').select('role, status');
          const pendingStudentsCount = (acctData || []).filter(a => a.role === 'student' && a.status === 'pending').length;

          const { data: recData } = await db.from('recommendations').select('id').eq('status', 'pending_review');
          const pendingRecsCount = recData?.length || 0;

          const { data: subData } = await db.from('subjects').select('id');
          const subjectCount = subData?.length || 10;

          let passingThreshold = 75;
          let maxFailedPrereqs = 3;
          try {
            const { data: setThresh } = await db.from('settings').select('value').eq('key', 'passing_grade_threshold').limit(1);
            if (setThresh?.[0]?.value) passingThreshold = Number(setThresh[0].value);
            const { data: setPrereq } = await db.from('settings').select('value').eq('key', 'max_failed_prerequisites').limit(1);
            if (setPrereq?.[0]?.value) maxFailedPrereqs = Number(setPrereq[0].value);
          } catch (e) { }

          const q = query.toLowerCase();
          const requestedFormat = detectRequestedFileFormat(query);

          // Check if admin asks for a list or export of all students
          if (q.includes('list') || q.includes('all student') || q.includes('export student') || q.includes('download student') || q.includes('directory')) {
            let fileData = '';
            let filename = '';
            let fileLabel = '';

            if (requestedFormat === 'word') {
              fileData = generateStudentsListWord(allStudents, 'GCT Students Directory');
              filename = `GCT_Students_Directory_${Date.now()}.doc`;
              fileLabel = `Download All Students Directory (Word Document)`;
            } else {
              fileData = generateStudentsListCsv(allStudents, 'GCT_Students_Directory');
              filename = `GCT_Students_Directory_${Date.now()}.csv`;
              fileLabel = `Download All Students Directory (Excel Spreadsheet)`;
            }

            fileExport = {
              filename,
              format: requestedFormat,
              csv_data: fileData,
              data: fileData,
              label: fileLabel
            };

            const studentsTableMarkdown = buildStudentsTableMarkdown(allStudents, 15);

            assistantResponse = userIsTagalog
              ? `### Direktoryo ng mga Estudyante ng GCT\nKasalukuyang may **${studentCount}** na rehistradong estudyante sa database.\n\n**Listahan ng mga Estudyante (Unang 15 talaan):**\n${studentsTableMarkdown}\n${allStudents.length > 15 ? `\n*... at ${allStudents.length - 15} pang mga estudyante sa database.*` : ''}\n\n*Maaari mong i-download ang buong listahan bilang ${requestedFormat.toUpperCase()} file gamit ang button sa ibaba, o maghanap ng partikular na Student ID.*`
              : `### GCT Student Directory Report\nThe system currently manages **${studentCount}** registered students.\n\n**Directory Roster (First 15 records):**\n${studentsTableMarkdown}\n${allStudents.length > 15 ? `\n*... and ${allStudents.length - 15} more students in the database.*` : ''}\n\n*You can download the complete student list as a ${requestedFormat.toUpperCase()} file using the button below, or query an individual student ID.*`;
            systemPrompt = '';
          } else if (
            /\b\d{4}-\d{4,5}\b/.test(query) ||
            /\b\d{4,6}\b/.test(query) ||
            /\bGCT-\d+\b/i.test(query) ||
            /\b(student|records?|grades?|profile|evaluation|transcript|show\s+record|search|find|grades\s+of|assess|assessment)\b/i.test(query) ||
            /\b(?:student\s*id|id\s*number|id\s*#?)\b/i.test(query)
          ) {
            assistantResponse = userIsTagalog
              ? `**Walang nahanap na student record** para sa: **"${query.trim()}"**.

**Mga suhestiyon:**
1. **Student ID:** Siguraduhing tama ang numero (halimbawa: \`2024-0001\` o \`12718\`).
2. **Pangalan:** Siguraduhing tama ang spelling ng apelyido o unang pangalan.
3. **Master Directory:** Maaari mong buksan ang tab ng **Student Academic Records** para tingnan ang kumpletong listahan ng lahat ng ${studentCount} estudyante sa database.`
              : `**No student record found** matching: **"${query.trim()}"**.

**Suggestions:**
1. **Student ID:** Verify the ID number (e.g., \`2024-0001\` or \`12718\`).
2. **Name:** Double check the spelling of the surname or first name.
3. **Master Directory:** Open the **Student Academic Records** tab to view the complete roster of ${studentCount} registered students.`;
            systemPrompt = '';
          } else if (/\b(hi|hello|hey|kumusta|kamusta|good\s*morning|good\s*afternoon|good\s*evening|mabuhay)\b/i.test(q)) {
            assistantResponse = userIsTagalog
              ? `Hello po, **${userName}**! Kumusta po kayo?

Ako ang inyong **GCT Registrar Operations Assistant**. Handa akong tumulong sa:
• **Student Records & Grades:** Mag-type ng Student ID o apelyido upang makita ang buong academic evaluation.
• **Download Reports:** Mag-generate ng file export sa **Excel (.csv)**, **Word (.doc)**, o **Text (.txt)**.
• **Registrar Tasks & Opinions:** Alamin ang pending student registrations, subject recommendation approvals, curriculum rules, o humingi ng formal advising evaluation sa isang estudyante.

May partikular ka bang estudyante o ulat na nais suriin ngayon?`
              : `Hello, **${userName}**!

I am your **GCT Registrar Operations Assistant**. I am ready to assist with:
• **Student Records & Grades:** Search any Student ID or surname to view comprehensive academic evaluations.
• **Download Reports:** Export official records to **Excel (.csv)**, **Word (.doc)**, or **Text (.txt)**.
• **Registrar Governance & Advising:** Monitor pending registrations, recommendation evaluations, curriculum rules, or request formal advising opinions.

Which student record or operational report would you like to review today?`;
            systemPrompt = '';
          } else if (/\b(ano kaya mo|ano magagawa mo|paano|help|tulong|guide|features?|capabilities)\b/i.test(q)) {
            assistantResponse = userIsTagalog
              ? `Narito ang mga pangunahing magagawa ko para sa Registrar Operations:

1. **Student Academic Lookups & Opinions:**
   - I-type ang Student ID o apelyido ng estudyante para makita ang GWA, passed units, at deficiencies.
   - Humingi ng evaluation o opinyon patungkol sa standing o prerequisite bottlenecks ng estudyante.
   - May interactive button para direktang buksan ang profile sa **Academic Records** o **Subject Recommendations**.
2. **Multi-Format Reports Generation:**
   - Sabihin lang: *"Generate in Excel"*, *"Export in Word"*, o *"Download as Text"* para makakuha ng official printable copy.
3. **Enrollment & Rules Oversight:**
   - Itanong: *"How many student registrations are pending?"*
   - Itanong: *"What are the academic threshold rules?"*

Aling rekord ng estudyante o operational report ang nais mong suriin ngayon?`
              : `Here are the core operations available for Registrar and Staff:

1. **Student Academic Lookups & Evaluations:**
   - Search by Student ID or surname to view full course history, GWA, earned units, and prerequisites.
   - Request formal advising opinions or assessment summaries for any student.
   - Jump directly to records via interactive shortcuts to **Academic Records** or **Subject Recommendations**.
2. **Multi-Format Report Generation:**
   - Simply ask: *"Generate in Excel"*, *"Export in Word"*, or *"Download as Text"* for printable official archives.
3. **Institutional Governance & Rules:**
   - Ask: *"How many student registrations are pending?"*
   - Ask: *"What are the academic threshold rules?"*

Which student record or operational report would you like to review today?`;
            systemPrompt = '';
          } else if (/\b(magkano|presyo|pricing|cost|bayad|api\s*key|gemini\s*cost)\b/i.test(q)) {
            assistantResponse = userIsTagalog
              ? `Tungkol sa Google Gemini API:
- Ang Google AI Studio ay may **Free Tier** (libreng gamitin para sa trial at development).
- Para sa production gamit ang **Pay-as-you-go (Blended Rate)**, ang Gemini Flash ay napakamura: humigit-kumulang **$0.075 bawat 1 milyong input tokens** (nasa ilang sentimo lamang sa libo-libong chat queries).
- Kung naabot ang daily limit ng free key, awtomatikong gumagana ang built-in GCT database rule engine upang hindi maantala ang serbisyo!

Nais mo ba ng higit pang teknikal na detalye ukol sa system settings o token usage?`
              : `About the Google Gemini API:
- Google AI Studio provides a generous **Free Tier** suitable for development and operational evaluation.
- For production under **Pay-as-you-go rates**, Gemini Flash is economical at approximately **$0.075 per 1 million input tokens**.
- If quota limits are reached, the system automatically engages the built-in GCT database rule engine to maintain uninterrupted service.

Would you like more technical details on system settings or token usage?`;
            systemPrompt = '';
          } else if (q.includes('pending') || q.includes('approval') || q.includes('signup')) {
            assistantResponse = userIsTagalog
              ? `### Student Registration Approval Queue
- **Pending Approvals:** **${pendingStudentsCount}** bagong student account ang naghihintay ng verification.
- **Office Governance:** Maaari mong suriin ang mga ID photo, kumpirmahin ang mga detalye, at i-approve o i-reject ang registration sa **User & Account Governance** tab.

Nais mo ba ng gabay patungo sa User & Account Governance tab, o suriin ang isang partikular na aplikante?`
              : `### Student Registration Approval Queue
- **Pending Approvals:** **${pendingStudentsCount}** new student accounts awaiting verification.
- **Office Governance:** You can inspect submitted ID photos, verify student credentials, and approve or reject submissions in the **User & Account Governance** tab.

Would you like guidance on navigating the User & Account Governance tab, or to check a specific pending registration?`;
            systemPrompt = '';
          } else if (q.includes('threshold') || q.includes('prereq') || q.includes('rule') || q.includes('setting')) {
            assistantResponse = userIsTagalog
              ? `### Institutional Academic Rules & Thresholds
- **Minimum Passing Grade Threshold:** **${passingThreshold}%** (katumbas ng Grade 3.00)
- **Maximum Allowed Failed Prerequisites:** **${maxFailedPrereqs}** subjects bago masuspinde ang enrollment
- **Active Academic Year:** 2025–2026 (Semester 1)
*Maaaring baguhin ang mga pamantayan sa System Settings.*

Nais mo bang suriin ang mga estudyanteng lumampas sa limitasyon ng bagsak na prerequisites, o baguhin ang system settings?`
              : `### Institutional Academic Rules & Thresholds
- **Minimum Passing Grade Threshold:** **${passingThreshold}%** (Grade 3.00 equivalent)
- **Maximum Allowed Failed Prerequisites:** **${maxFailedPrereqs}** subjects before enrollment suspension
- **Active Academic Year:** 2025–2026 (Semester 1)
*Rules can be configured under System Settings.*

Would you like to review the list of students exceeding the prerequisite failure threshold, or adjust system settings?`;
            systemPrompt = '';
          } else if (q.includes('queue') || q.includes('recommend') || q.includes('review')) {
            assistantResponse = userIsTagalog
              ? `### Subject Recommendations & Advising
- **Status:** Direktang gumagana ang automated prerequisite evaluation para sa mga estudyante.
- Hindi na kinakailangan ng manual approval queue dahil real-time na kinakalkula ang recommended subjects at retakes batay sa kanilang naipasang prerequisites.

Nais mo bang maghanap ng partikular na estudyante upang masuri ang kanyang prerequisite recommendations?`
              : `### Subject Recommendations & Advising
- **Status:** Automated prerequisite evaluation is directly active for students.
- Manual approval review is no longer required as recommended subjects, eligible unlocks, and retakes are computed dynamically in real-time.

Would you like to search for an individual student to inspect their automated prerequisite recommendations?`;
            systemPrompt = '';
          } else {
            assistantResponse = userIsTagalog
              ? `Kumusta, **${userName}** (Registrar Operations)!

Ako ang inyong GCT Registrar Operations Assistant na may direktang koneksyon sa database. Maaari mong itanong:
1. **Paghahanap ng record at academic evaluation:** I-type ang Student ID (halimbawa: \`2024-0001\`, \`12718\`) o pangalan ng estudyante upang makita ang buong grado, GWA, advising opinions, at downloadable file.
2. **Direktang pagbubukas ng student profile:** May mabilisang links patungo sa **Academic Records** o **Subject Recommendations**.
3. **Institutional analytics at opisyal na payo:** Magtanong ukol sa pending approvals, failure trends, curriculum compliance, at iba pa.

Aling Student ID o katanungang pang-operasyon ang nais mong simulan natin ngayon?`
              : `Hello **${userName}** (Registrar Operations)!

I am your GCT Registrar Operations Assistant with direct database access. You can ask me to:
1. **Search any student record & evaluation:** Enter a Student ID (e.g. \`2024-0001\`, \`12718\`) or name to review course grades, GWA, advising opinions, and downloadable reports.
2. **Open student records:** Use direct action shortcuts to open their profile in **Academic Records** or **Subject Recommendations**.
3. **Institutional analytics & advice:** Inquire about pending student approvals, curriculum compliance, or request formal advising guidance.

Which student ID or operational inquiry would you like to begin with today?`;

            // Set prompt for Gemini to answer the user's specific query directly
            systemPrompt = `You are the GCT Registrar Operations AI Assistant for Garcia College of Technology.
User: ${userName} (Registrar Administrator / Staff).
Database Status:
- Registered Students: ${studentCount}
- Pending Student Account Approvals: ${pendingStudentsCount}
- Minimum Passing Threshold: ${passingThreshold}%
- Maximum Allowed Failed Prerequisites: ${maxFailedPrereqs} subjects
- Subject Advising: Directly automated in real-time (no manual recommendation approval queue required).

CRITICAL ANTI-HALLUCINATION & FACTUAL SAFEGUARDS (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY DO NOT INVENT, SIMULATE, OR HALLUCINATE ANY STUDENT PROFILES, GRADES, NAMES, OR IDS.
   - If the user asks for a specific student's record, grades, standing, or evaluation and no official student evaluation table is provided in this prompt, you MUST state that no student record was found in the official database.
   - NEVER create fictitious student names (such as 'Juan Dela Cruz', 'Dela Cruz, Juan Miguel', 'John Doe', or any placeholder names).
   - NEVER invent fake student IDs, fictional grades, or simulated academic standings.
   - Ground all factual answers strictly in the official GCT data provided.

PRIMARY LANGUAGE DIRECTIVE:
Your main and default communication language is English.
However, if the user asks or speaks in Tagalog / Taglish (userIsTagalog = ${userIsTagalog}), you MUST respond naturally in Tagalog / Filipino. Otherwise, respond strictly in English.

CRITICAL FORMATTING INSTRUCTIONS:
1. ZERO EMOJIS: Do NOT use any emojis or decorative symbols in your response under any circumstance.
2. ABSOLUTELY NO MEMORANDUM FORMAT: Never output "MEMORANDUM", "TO:", "FROM:", "DATE:", "SUBJECT:", or institutional memo headers. Do NOT format answers as an internal memorandum.
3. MANDATORY MARKDOWN TABLES: Whenever presenting student lists, rosters, grades, or subject recommendations, ALWAYS format them as structured Markdown tables with pipe '|' delimiters. Never output lists of students or courses as run-on paragraphs.
4. SCOPE RESTRICTION: You are STRICTLY an assistant for the Garcia College of Technology (GCT) Subject Assessment and Recommendation System. If the user asks about anything unrelated (such as weather, sports, general trivia, cooking, or general news), politely apologize and state that it is outside your scope because you are exclusively for the GCT Subject Assessment and Recommendation System.
5. REGISTRAR ADVISING OPINIONS: When the registrar or administrator asks for your opinion, advice, or evaluation, provide a professional, structured, and insightful academic evaluation with clear explanations and tables.

MANDATORY FOLLOW-UP QUESTION DIRECTIVE:
- Every answer to a user message, question, or inquiry MUST conclude with a relevant, proactive follow-up question.
- Guide the user to the next logical operational step (e.g. asking which student record to view, whether to export a file, or review prerequisites).
- NEVER end your reply without a follow-up question.

USER MESSAGE: "${query}"

Instructions:
- Directly, specifically, and conversationally reply to what the Registrar messaged or asked.
- Provide accurate operational guidance regarding GCT Registrar tasks, student evaluations, curriculum rules, or reports.
- If they asked to export or download, note that the ${requestedFormat.toUpperCase()} file is ready below.
- Reply in Tagalog if the user used Tagalog; otherwise reply in English as the main language.
- Always conclude with an engaging, helpful follow-up question.`;
          }
        }
      }
    }

    // Call Google Gemini API if key is set and quota cooldown is not active
    require('dotenv').config();
    const apiKey = process.env.GEMINI_API_KEY;
    const isGeminiBlocked = Date.now() < geminiQuotaBlockedUntil;

    if (process.env.NODE_ENV !== 'test' && apiKey && apiKey !== 'your-google-gemini-api-key' && systemPrompt && !isGeminiBlocked) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const modelName = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

        const geminiPromise = ai.models.generateContent({
          model: modelName,
          contents: systemPrompt
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API call timed out after 35 seconds')), 35000)
        );

        const response = await Promise.race([geminiPromise, timeoutPromise]);
        if (response && response.text) {
          assistantResponse = stripEmojis(cleanMemorandumFormatting(response.text));
          geminiQuotaBlockedUntil = 0; // Success, reset cooldown
        }
      } catch (geminiError) {
        console.warn('Gemini API call error, using grounded role-based response:', geminiError.message);
        if (/quota|429|RESOURCE_EXHAUSTED/i.test(geminiError.message)) {
          // Cooldown 3 minutes so users don't suffer 6s latency on known exhausted quota
          geminiQuotaBlockedUntil = Date.now() + 180000;
        }
      }
    }

    // Strictly enforce zero emojis and zero memorandum formatting on final response
    assistantResponse = stripEmojis(cleanMemorandumFormatting(assistantResponse));

    // MANDATORY FOLLOW-UP QUESTION ENFORCEMENT:
    // Guarantee that every question or response ends with a relevant, proactive follow-up question
    const effectiveIntent = studentAction?.intent || (typeof queryIntent !== 'undefined' ? queryIntent : 'general');
    assistantResponse = ensureFollowUpQuestion(assistantResponse, {
      role: userRole,
      intent: effectiveIntent,
      userIsTagalog,
      studentId: studentAction?.student_id
    });

    const followUpQuestions = generateFollowUpQuestions({
      role: userRole,
      intent: effectiveIntent,
      userIsTagalog,
      studentId: studentAction?.student_id
    });

    // Log chat entry in Supabase chat_logs table
    const chatId = 'chat-' + Date.now();
    const now = new Date().toISOString();

    try {
      await db.from('chat_logs').insert([{
        id: chatId,
        user_id: userId,
        query,
        response: assistantResponse,
        created_at: now
      }]);
    } catch (logErr) {
      console.warn('Chat log save skipped:', logErr.message);
    }

    res.json({
      id: chatId,
      query,
      response: assistantResponse,
      role: userRole,
      timestamp: now,
      file_export: fileExport || null,
      student_action: studentAction || null,
      follow_up_questions: followUpQuestions
    });
  } catch (error) {
    console.error('Chatbot Query Error:', error);
    res.status(500).json({ error: error.message || 'Chatbot service error' });
  }
}

module.exports = {
  queryChatbot,
  isTagalogQuery,
  hasRecordForAcademicTerm,
  isEnrollmentEligibilityQuery,
  buildEnrollmentEligibilityResponse,
  extractTargetTermAndSemester,
  matchesRecordTerm,
  cleanMemorandumFormatting,
  buildGradesTableMarkdown,
  buildRecommendationsTableMarkdown,
  buildDeficienciesTableMarkdown,
  buildStudentsTableMarkdown,
  classifyStudentQueryIntent,
  formatTargetTermText,
  generateNarrativeExplanation,
  getStudentEvaluationData,
  findMultipleTargetStudents,
  generateMultiStudentCsv,
  getStudentEnrollmentStatus,
  getDistinctTermsList,
  generateStudentCsv,
  ensureFollowUpQuestion,
  generateFollowUpQuestions,
  isStudentGreetingQuery,
  buildStudentGreetingResponse,
  parseCohortFilter,
  isCohortDetailsComplete,
  generateCurriculumRecsCsv,
  generateCohortGradesCsv,
  buildCurriculumTableMarkdown,
  buildCohortGradesSummaryTableMarkdown
};
