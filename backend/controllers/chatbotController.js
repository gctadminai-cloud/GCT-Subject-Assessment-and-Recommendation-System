const { GoogleGenAI } = require('@google/genai');
const { supabase } = require('../config/supabase');
const { normalizeSubjCode } = require('../services/assessmentEngine');

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
    answerEn: `**Admission Requirements for New College Students:**\n- High School Report (SF 9)\n- Certificate of Good Moral Character\n- Four (4) recent 1×1 ID pictures\n- Photocopy of PSA Birth Certificate`,
    answerTl: `**Mga Kinakailangan sa Admission para sa Bagong Estudyante (New College Students):**\n- High School Report (SF 9)\n- Certificate of Good Moral Character\n- Apat (4) na pirasong 1×1 ID pictures\n- Photocopy ng PSA Birth Certificate`
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
    answerEn: `**Requirements for Old Students:**\n- Clearance from the previous semester\n- School ID\n- Grades from the previous semester`,
    answerTl: `**Mga Kinakailangan para sa Dating Estudyante (Old Students):**\n- Clearance mula sa nakaraang semestre\n- School ID\n- Mga Marka (Grades) mula sa nakaraang semestre`
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
    answerEn: `**Requirements for Transferees:**\n- Transfer Credentials / Honorable Dismissal\n- Certified copy of college subjects taken\n- Certificate of Good Moral Character\n- Four (4) recent 1×1 ID pictures\n- Photocopy of PSA Birth Certificate`,
    answerTl: `**Mga Kinakailangan para sa Transferees:**\n- Transfer Credentials / Honorable Dismissal\n- Certified copy ng mga nakuhang college subjects\n- Certificate of Good Moral Character\n- Apat (4) na pirasong 1×1 ID pictures\n- Photocopy ng PSA Birth Certificate`
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
    answerEn: `**Accreditation of Subjects for Transferees:**\nYes. Transferees can apply for accreditation of subjects through the Office of the Registrar, subject to approval by the College Dean.`,
    answerTl: `**Pag-credit ng mga Nakaraang Subjects para sa Transferees:**\nOpo. Maaaring mag-apply ang mga transferee para sa accreditation ng kanilang mga subjects sa pamamagitan ng Office of the Registrar, batay sa pagsusuri at pag-apruba ng College Dean.`
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
    answerEn: `**GCT College Registrar Contact Information:**\nThe College Registrar can be contacted at:\n- **Phone:** (036) 262-8621\n- **Email:** gctregistrar.collegedept2021@gmail.com\n- **Office Hours:** Monday to Friday, 8:00 AM – 5:00 PM`,
    answerTl: `**Impormasyon sa Pakikipag-ugnayan sa GCT College Registrar:**\nMaaaring makontak ang College Registrar sa:\n- **Telepono:** (036) 262-8621\n- **Email:** gctregistrar.collegedept2021@gmail.com\n- **Oras ng Tanggapan:** Lunes hanggang Biyernes, 8:00 AM – 5:00 PM`
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
    answerEn: `**GCT's Mission:**\nGCT aims to provide quality education and develop the full potential and capabilities of individuals.`,
    answerTl: `**Misyon ng GCT:**\nLayunin ng GCT na magbigay ng de-kalidad na edukasyon at paunlarin ang buong potensyal at kakayahan ng bawat indibidwal.`
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
    answerEn: `**Establishment of Garcia College of Technology:**\nGarcia College of Technology (GCT) was established in **1968**.`,
    answerTl: `**Pagtatatag ng Garcia College of Technology:**\nAng Garcia College of Technology (GCT) ay naitatag noong taong **1968**.`
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
    answerEn: `**Garcia College of Technology Location:**\nGCT is located on **Osmeña Avenue, Estancia, Kalibo, Aklan**.`,
    answerTl: `**Lokasyon ng Garcia College of Technology:**\nAng GCT ay matatagpuan sa **Osmeña Avenue, Estancia, Kalibo, Aklan**.`
  }
];

const GCT_FAQS_CONTEXT_BLOCK = `
OFFICIAL GCT INSTITUTIONAL FAQs & FACTS:
1. Admission Requirements for New College Students:
   - High School Report (SF 9)
   - Certificate of Good Moral Character
   - Four (4) recent 1x1 ID pictures
   - Photocopy of PSA Birth Certificate
2. Requirements for Old Students:
   - Clearance from the previous semester
   - School ID
   - Grades from the previous semester
3. Requirements for Transferees:
   - Transfer Credentials / Honorable Dismissal
   - Certified copy of college subjects taken
   - Certificate of Good Moral Character
   - Four (4) recent 1x1 ID pictures
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
      ? `### Garcia College of Technology — Mga Madalas Itanong (FAQs)\n\n1. **Admission Requirements (New College Students):**\n   - High School Report (SF 9)\n   - Certificate of Good Moral Character\n   - Apat (4) na 1×1 ID pictures\n   - Photocopy ng PSA Birth Certificate\n\n2. **Requirements para sa Dating Estudyante (Old Students):**\n   - Clearance mula sa nakaraang semestre\n   - School ID\n   - Grades mula sa nakaraang semestre\n\n3. **Requirements para sa Transferees:**\n   - Transfer Credentials / Honorable Dismissal\n   - Certified copy ng subjects taken\n   - Certificate of Good Moral Character\n   - Apat (4) na 1×1 ID pictures\n   - Photocopy ng PSA Birth Certificate\n\n4. **Pag-credit ng Subjects para sa Transferees:**\n   - Opo. Maaaring mag-apply para sa accreditation sa Office of the Registrar, subject to approval ng College Dean.\n\n5. **Pakikipag-ugnayan sa Registrar:**\n   - Telepono: (036) 262-8621 | Email: gctregistrar.collegedept2021@gmail.com\n\n6. **Misyon ng GCT:**\n   - Magbigay ng de-kalidad na edukasyon at paunlarin ang buong potensyal at kakayahan ng bawat indibidwal.\n\n7. **Kailan Naitatag:**\n   - Naitatag noong taong 1968.\n\n8. **Lokasyon:**\n   - Osmeña Avenue, Estancia, Kalibo, Aklan.`
      : `### Garcia College of Technology — Frequently Asked Questions (FAQs)\n\n1. **Admission Requirements for New College Students:**\n   - High School Report (SF 9)\n   - Certificate of Good Moral Character\n   - Four (4) recent 1×1 ID pictures\n   - Photocopy of PSA Birth Certificate\n\n2. **Requirements for Old Students:**\n   - Clearance from the previous semester\n   - School ID\n   - Grades from the previous semester\n\n3. **Requirements for Transferees:**\n   - Transfer Credentials / Honorable Dismissal\n   - Certified copy of college subjects taken\n   - Certificate of Good Moral Character\n   - Four (4) recent 1×1 ID pictures\n   - Photocopy of PSA Birth Certificate\n\n4. **Can transferees have previous subjects credited?**\n   - Yes. Transferees can apply for accreditation of subjects through the Office of the Registrar, subject to approval by the College Dean.\n\n5. **How to contact the GCT College Registrar:**\n   - Phone: (036) 262-8621 | Email: gctregistrar.collegedept2021@gmail.com\n\n6. **GCT's Mission:**\n   - GCT aims to provide quality education and develop the full potential and capabilities of individuals.\n\n7. **When Established:**\n   - GCT was established in 1968.\n\n8. **Campus Location:**\n   - GCT is located on Osmeña Avenue, Estancia, Kalibo, Aklan.`;
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

Maaari mo akong tanungin tungkol sa iyong mga subjects, grades, curriculum, o academic advising.`;
  }

  return `I apologize, but that topic is outside my scope. I am an AI assistant specifically dedicated to the Garcia College of Technology (GCT) Subject Assessment and Recommendation System.

My capabilities are strictly focused on:
- Student academic records, grades, and completion history
- Cumulative GWA calculations and academic standing
- Curriculum matrix and prerequisite tracking (BSIT & BSCS)
- Automated subject recommendations and advising slips
- Portal registration and enrollment inquiries

Please let me know if you need assistance with GCT academic records, subject evaluation, or enrollment guidance.`;
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
 * e.g., "student 12310 2nd year first sem" -> { year: 2, semester: '1', target_term: '2nd Year • 1st Sem' }
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

  // If year was not explicitly mentioned, but student's year level is known and semester was requested:
  const effectiveYear = detectedYear || (Number(studentYear) >= 1 && Number(studentYear) <= 4 ? Number(studentYear) : null);

  let targetTerm = null;
  if (effectiveYear && detectedSem && detectedSem !== 'summer') {
    const yrLabel = effectiveYear === 1 ? '1st' : effectiveYear === 2 ? '2nd' : effectiveYear === 3 ? '3rd' : '4th';
    const semLabel = detectedSem === '2' ? '2nd' : '1st';
    targetTerm = `${yrLabel} Year • ${semLabel} Sem`;
  }

  return {
    year: effectiveYear,
    semester: detectedSem,
    target_term: targetTerm
  };
}

/**
 * Format academic record as a downloadable CSV/Excel spreadsheet string
 */
function generateStudentCsv(student, records, gwa) {
  const headers = ['Student ID', 'Student Name', 'Program', 'Year Level', 'Section / Schedule', 'Subject Code', 'Subject Title', 'Units', 'Grade', 'Status', 'Academic Term'];
  const rows = [headers.join(',')];

  const studentId = student.student_id || student.id || 'N/A';
  const studentName = (student.name || student.full_name || 'Student').replace(/"/g, '""');
  const program = (student.program || 'BSIT').replace(/"/g, '""');
  const yearLevel = student.year_level || student.year || 1;
  const schedule = (student.schedule || student.section || 'A').replace(/"/g, '""');

  if (!records || records.length === 0) {
    rows.push([
      `"${studentId}"`,
      `"${studentName}"`,
      `"${program}"`,
      `"${yearLevel}"`,
      `"${schedule}"`,
      'N/A',
      'No graded subjects recorded yet',
      '0',
      'N/A',
      'N/A',
      'N/A'
    ].join(','));
  } else {
    for (const r of records) {
      const code = (r.code || '').replace(/"/g, '""');
      const title = (r.title || '').replace(/"/g, '""');
      const units = Number(r.units) || 3;
      const grade = r.grade != null ? r.grade : 'N/A';
      const status = (r.status || 'passed').replace(/"/g, '""');
      const term = (r.term || 'Academic Record').replace(/"/g, '""');

      rows.push([
        `"${studentId}"`,
        `"${studentName}"`,
        `"${program}"`,
        `"${yearLevel}"`,
        `"${schedule}"`,
        `"${code}"`,
        `"${title}"`,
        units,
        grade,
        `"${status}"`,
        `"${term}"`
      ].join(','));
    }
  }

  // Summary row at bottom for Excel viewers
  rows.push('');
  rows.push(`"","","","","","Cumulative GWA:","${gwa || 'N/A'}","","Total Graded Subjects:","${records.length}",""`);

  return rows.join('\r\n');
}

/**
 * Format academic record as a downloadable Microsoft Word document (.doc)
 */
function generateStudentWord(student, records, gwa) {
  const studentId = student.student_id || student.id || 'N/A';
  const studentName = student.name || student.full_name || 'Student';
  const program = student.program || 'BSIT';
  const yearLevel = student.year_level || student.year || 1;
  const schedule = student.schedule || student.section || 'Regular';

  const rowsHtml = (!records || records.length === 0)
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
<title>Official Academic Record - ${studentName}</title>
<style>
  body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1e293b; }
  .header { text-align: center; border-bottom: 3px double #1e3a8a; padding-bottom: 14px; margin-bottom: 24px; }
  .title { font-size: 18pt; font-weight: bold; color: #1e3a8a; letter-spacing: 0.5px; }
  .subtitle { font-size: 11pt; color: #475569; margin-top: 4px; font-weight: 600; }
  .meta-box { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 14px 18px; margin-bottom: 20px; border-radius: 6px; }
  .meta-table { width: 100%; border-collapse: collapse; }
  .meta-table td { padding: 5px 8px; font-size: 11pt; }
  .grades-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .grades-table th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #1e3a8a; padding: 10px 12px; font-size: 11pt; text-align: left; }
  .footer { margin-top: 36px; font-size: 9.5pt; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">GARCIA COLLEGE OF TECHNOLOGY</div>
    <div class="subtitle">OFFICE OF THE REGISTRAR — OFFICIAL ACADEMIC EVALUATION</div>
  </div>

  <div class="meta-box">
    <table class="meta-table">
      <tr>
        <td><strong>Student Name:</strong> ${studentName}</td>
        <td><strong>Student ID:</strong> ${studentId}</td>
      </tr>
      <tr>
        <td><strong>Degree Program:</strong> ${program}</td>
        <td><strong>Year Level & Section:</strong> Year ${yearLevel} (${schedule})</td>
      </tr>
      <tr>
        <td><strong>Cumulative GWA:</strong> <span style="color:#1e3a8a; font-weight:bold;">${gwa || 'N/A'}</span></td>
        <td><strong>Evaluation Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
      </tr>
    </table>
  </div>

  <h3 style="color:#1e3a8a; margin-bottom:8px; font-size:13pt;">Curriculum Grades & Course Completion</h3>
  <table class="grades-table">
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
      ${rowsHtml}
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
function generateStudentText(student, records, gwa) {
  const lines = [
    '====================================================================',
    '                   GARCIA COLLEGE OF TECHNOLOGY                     ',
    '              OFFICE OF THE REGISTRAR - ACADEMIC RECORD             ',
    '====================================================================',
    `Student Name: ${student.name || student.full_name || 'Student'}`,
    `Student ID:   ${student.student_id || student.id || 'N/A'}`,
    `Program:      ${student.program || 'BSIT'}`,
    `Year Level:   Year ${student.year_level || student.year || 1} (${student.schedule || student.section || 'Regular'})`,
    `Cumulative GWA: ${gwa || 'N/A'}`,
    `Date Generated: ${new Date().toLocaleString()}`,
    '--------------------------------------------------------------------',
    'CODE       | TITLE                                | UNITS | GRADE | STATUS',
    '--------------------------------------------------------------------'
  ];

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
  const headers = ['Student ID', 'Full Name', 'Program', 'Year Level', 'Section / Schedule', 'Status'];
  const rows = [headers.join(',')];

  for (const s of studentsList) {
    rows.push([
      `"${s.student_id || s.id || ''}"`,
      `"${(s.name || s.full_name || '').replace(/"/g, '""')}"`,
      `"${s.program || 'BSIT'}"`,
      `"${s.year_level || s.year || 1}"`,
      `"${s.schedule || s.section || 'A'}"`,
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
      <td style="border:1px solid #cbd5e1; padding:6px 10px; font-family:Calibri,sans-serif; text-align:center;">${s.schedule || s.section || 'A'}</td>
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
    <thead><tr><th>Student ID</th><th>Full Name</th><th>Program</th><th>Year</th><th>Section</th><th>Status</th></tr></thead>
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
      return `Hindi ko pa makukumpirma kung maaari ka nang mag-enroll sa Year ${nextYear} dahil walang ma-verify na kasalukuyang academic year at semester sa system settings. Pakikumpirma muna ito sa Registrar.`;
    }
    if (!hasActiveTermGrades) {
      return `Hindi pa makukumpirma kung maaari ka nang mag-enroll sa Year ${nextYear}. Nasa Year ${currentYear} ka ayon sa kasalukuyang student record. Ang active term ay ${activeYear} ${semesterLabel}, pero wala pang grade record para rito${latestTerm ? `; ang pinakahuling nasa system ay ${latestTerm}` : ''}. Hindi sapat ang bilang ng mga naipasang subject o units para ideklarang tapos na ang kasalukuyang taon. Hintayin munang ma-release at ma-encode ang grades ng active semester, saka ipa-check sa Registrar ang lahat ng required subjects at prerequisites bago mag-enroll sa susunod na taon.`;
    }
    return `May grade record na para sa active term na ${activeYear} ${semesterLabel}, pero hindi pa rin sapat ang kabuuang passed subjects o units para tiyaking maaari ka nang mag-enroll sa Year ${nextYear}. Kailangan munang makumpirma na kumpleto at pasado ang lahat ng required subjects para sa Year ${currentYear} at natugunan ang prerequisites. Ipa-verify ang final eligibility at advising slip sa Registrar.`;
  }

  if (!activeTerm) {
    return `I cannot confirm Year ${nextYear} enrollment eligibility because the active academic year and semester are not available in system settings. Please verify the current term with the Registrar.`;
  }
  if (!hasActiveTermGrades) {
    return `I cannot confirm Year ${nextYear} enrollment eligibility yet. Your student record lists you as Year ${currentYear}. The active term is ${activeYear} ${semesterLabel}, but no grade records are available for that term${latestTerm ? `; the latest recorded term is ${latestTerm}` : ''}. A cumulative passed-subject or unit count alone does not establish that the current year is complete. Wait for the active-semester grades to be released and encoded, then ask the Registrar to verify all required subjects and prerequisites before enrolling in the next year.`;
  }
  return `There are grade records for the active term (${activeYear} ${semesterLabel}), but a total passed-subject or unit count alone cannot confirm Year ${nextYear} enrollment eligibility. The Registrar must verify that all required Year ${currentYear} subjects are complete and that prerequisites are satisfied before confirming your next-year enrollment and advising slip.`;
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
  // Check for ID pattern: e.g. 10526, 2023-0001, GCT-10526, 9364, 12310
  const idMatch = query.match(/\b\d{4}-\d{4,5}\b/) || query.match(/\b\d{4,6}\b/) || query.match(/\bGCT-\d+\b/i);
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
      .select('student_id, student_name')
      .ilike('student_id', `%${clean}%`)
      .limit(1);
    if (grStudent && grStudent.length > 0) {
      return {
        id: grStudent[0].student_id,
        student_id: grStudent[0].student_id,
        name: grStudent[0].student_name || 'Student',
        program: 'BSIT',
        year_level: 3
      };
    }
  }

  // Retrieve students from database for fuzzy name matching
  const { data: studentsData } = await supabase.from('students').select('*').limit(2000);
  const students = studentsData || [];

  const lowerQuery = query.toLowerCase();

  // Exclude institutional and general stop words so school name (Garcia College of Technology) never triggers false student matches
  const stopWords = new Set([
    'garcia', 'college', 'technology', 'system', 'subject', 'subjects', 'course', 'courses',
    'curriculum', 'bsit', 'bscs', 'eval', 'evaluation', 'portal', 'registrar', 'student', 'students',
    'record', 'records', 'grade', 'grades', 'assessment', 'recommendation', 'recommendations',
    'advising', 'schedule', 'enrollment', 'enroll', 'admission', 'office', 'school', 'admin', 'staff',
    'gct', 'class', 'classes', 'ano', 'ang', 'trabaho', 'dito', 'saan', 'paano', 'bakit'
  ]);

  const hasStudentIntent = /\b(student|estudyante|kay|ni|si|record\s+of|grades?\s+of|profile\s+of|lookup|search|assessment\s+of)\b/i.test(lowerQuery);

  for (const s of students) {
    const fullName = (s.name || s.full_name || '').toLowerCase().trim();
    if (!fullName) continue;

    // Full name match (e.g. "Francis Joseph Garcia")
    const cleanFull = fullName.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanFull.length > 5 && lowerQuery.includes(cleanFull)) {
      return s;
    }

    const parts = fullName
      .split(/[\s,]+/)
      .filter(p => p.length >= 3 && !['jr', 'sr', 'iii', 'ii', 'iv'].includes(p) && !stopWords.has(p));

    if (parts.length === 0) continue;

    if (hasStudentIntent) {
      if (parts.some(p => new RegExp(`\\b${p}\\b`, 'i').test(lowerQuery))) {
        return s;
      }
    } else {
      const matchedCount = parts.filter(p => new RegExp(`\\b${p}\\b`, 'i').test(lowerQuery)).length;
      if (matchedCount >= 2) {
        return s;
      }
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

  // 2. If user sent broken continuation message (e.g. sent incomplete first part, then continuation)
  if (Array.isArray(history) && history.length > 0) {
    const userTurns = history.filter(h => h && (h.sender === 'user' || h.role === 'user') && h.text);
    const lastUserTurn = userTurns[userTurns.length - 1];
    if (lastUserTurn && lastUserTurn.text && lastUserTurn.text.trim() !== query.trim()) {
      const combined = `${lastUserTurn.text} ${query}`;
      const combinedMatch = await searchStudentInText(combined, supabase);
      if (combinedMatch) return combinedMatch;
    }

    // 3. Check recent conversation turns (latest to oldest) to recall previously discussed student
    const recentReversed = [...history].reverse();
    for (const turn of recentReversed) {
      const text = turn.text || turn.content || '';
      if (!text) continue;
      const turnMatch = await searchStudentInText(text, supabase);
      if (turnMatch) return turnMatch;
    }
  }

  return null;
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
  const { data: aRows } = await supabase
    .from('academic_records')
    .select('*')
    .or(orClause);

  const mergedMap = new Map();

  // Process historical grade_records first
  (gRows || []).forEach(g => {
    const subjRaw = (g.subject || '').trim();
    const subjClean = subjRaw.replace(/\s+/g, ' ');
    const subNorm = normalizeSubjCode(subjClean);
    const matchedSub = codeMap.get(subjClean.toLowerCase()) || codeMap.get(subNorm) || null;

    const semFormatted = (g.semester === 'Second' || g.semester === '2' || String(g.semester).toLowerCase().includes('2nd')) ? '2nd Sem' : '1st Sem';
    const termFormatted = `${g.academic_year || '2023-2024'} ${semFormatted}`;

    const rawGradeStr = String(g.raw_grade || '').trim();
    const isDropped = rawGradeStr === '9' || g.grade === 9 || rawGradeStr.toUpperCase() === 'DRP' || (g.needs_review && rawGradeStr === '9');
    const isFailed = rawGradeStr === '5' || g.grade === 5 || (g.grade !== null && Number(g.grade) > 3.0 && !isDropped);

    let status = 'passed';
    let cleanGrade = null;

    if (isDropped) {
      status = 'dropped';
      cleanGrade = null;
    } else if (isFailed) {
      status = 'failed';
      cleanGrade = 5.0;
    } else if (g.grade !== null && g.grade !== undefined && g.grade !== '') {
      const num = Number(g.grade);
      if (!isNaN(num)) {
        cleanGrade = num;
        status = num <= 3.0 ? 'passed' : 'failed';
      }
    }

    const recordKey = `${subNorm}-${termFormatted}`;
    const newEntry = {
      code: matchedSub?.code || subjClean,
      title: matchedSub?.title || g.subject_title || subjClean,
      units: Number(matchedSub?.units || g.units || 3),
      grade: cleanGrade,
      status,
      term: termFormatted,
      is_dropped: isDropped
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

    mergedMap.set(recordKey, {
      code: s?.code || r.subject_id || 'SUBJ',
      title: s?.title || r.subject_title || 'Curriculum Subject',
      units: Number(s?.units || r.units || 3),
      grade: r.grade !== null ? Number(r.grade) : null,
      status: r.status || (Number(r.grade) <= 3.0 ? 'passed' : 'failed'),
      term: termFormatted,
      is_dropped: false
    });
  });

  const records = Array.from(mergedMap.values());

  // 4. Query recommendations
  const { data: recsData } = await supabase
    .from('recommendations')
    .select('*')
    .or(orClause);

  return { records, recommendations: recsData || [] };
}


async function queryChatbot(req, res) {
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
        student_action: null
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
        systemPrompt = `You are the official GCT AI Assistant for Garcia College of Technology.
User status: Unauthenticated Visitor / Guest.
The user asked an official institutional FAQ about Garcia College of Technology.
Official GCT Institutional Fact:
${faqMatch}

${GCT_FAQS_CONTEXT_BLOCK}

PRIMARY LANGUAGE DIRECTIVE:
Answer in ${userIsTagalog ? 'Tagalog / Filipino' : 'English'}.
Strictly follow the zero emojis rule.
Answer accurately according to the official GCT facts provided above.

USER MESSAGE: "${query}"`;
      } else {
      const isRegistrationOrPublic = /\b(create account|create student account|how to register|register|sign up|signup|how to apply|apply|programs|program|course|courses|offer|admissions|admission|office hours|campus|location|contact|registrar office|faq|faqs)\b/i.test(query);

      const isConfidentialStudentQuery = /\b(grade|grades|gwa|record|records|transcript|passed|failed|fail|retake|prereq|prerequisite|eval|evaluation|standing|who is|status of|profile of|user list|students list|password|passwords)\b/i.test(query) || (/\b\d{4,6}\b/.test(query) && !isRegistrationOrPublic);

      if (isConfidentialStudentQuery && !isRegistrationOrPublic) {
        assistantResponse = userIsTagalog
          ? `**Limitadong Akses — Kailangang Mag-login**\n\nAng academic records, grades, curriculum evaluations, at subject recommendations ng mga mag-aaral ay mahigpit na kumpidensyal.\n\n**Hindi maaaring tingnan ang impormasyon ng estudyante nang hindi naka-login.**\n\nPakisuyong **mag-log in** gamit ang inyong opisyal na GCT account (Estudyante, Registrar Staff, o Administrator) upang tingnan ang academic records.\n\n*Kung wala ka pang account, i-click ang "Create Student Account" sa login screen upang magparehistro.*`
          : `**Access Restricted — Login Required**\n\nStudent academic records, grades, curriculum evaluations, and subject recommendations are strictly confidential.\n\n**No student information can be accessed without logging in.**\n\nPlease **log in** with your official GCT account (Student, Registrar Staff, or Administrator) to view academic records.\n\n*If you do not have an account yet, click "Create Student Account" on the login screen to register.*`;
        systemPrompt = '';
      } else {
        const q = query.toLowerCase();
        if (q.includes('register') || q.includes('create') || q.includes('sign up') || q.includes('apply')) {
          assistantResponse = userIsTagalog
            ? `Upang magparehistro para sa GCT Student Portal account:\n1. I-click ang "**Create Student Account**" sa login page.\n2. Punan ang enrollment form ng iyong Buong Pangalan, GCT Student ID Number, Program (BSIT o BSCS), Year Level, at Class Schedule.\n3. I-submit ang registration. Kapag na-verify na ng Registrar Staff ang iyong credentials, ia-activate ang iyong account!`
            : `To register for a GCT Student Portal account:\n1. Click "**Create Student Account**" on the login page.\n2. Complete the enrollment form with your Full Name, GCT Student ID Number, Program (BSIT or BSCS), Year Level, and Class Schedule.\n3. Submit your registration. Once Registrar Staff verifies your credentials, your account will be activated!`;
        } else if (q.includes('program') || q.includes('course') || q.includes('offer') || q.includes('bsit') || q.includes('curriculum')) {
          assistantResponse = userIsTagalog
            ? `Ang Garcia College of Technology ay nag-aalok ng Bachelor of Science in Information Technology (BSIT) at Computer Science (BSCS) programs na may automated prerequisite tracking at AI-based subject advising.\n\n*Upang makita ang sariling curriculum matrices at grade sheets, pakisuyong mag-log in muna.*`
            : `Garcia College of Technology offers Bachelor of Science in Information Technology (BSIT) and Computer Science (BSCS) programs with automated prerequisite tracking and AI-based subject advising.\n\n*To view individual curriculum matrices and grade sheets, please log in.*`;
        } else if (q.includes('pending') || q.includes('approval') || q.includes('wait')) {
          assistantResponse = userIsTagalog
            ? `Kung ang iyong account registration ay kasalukuyang pending approval, bineberipika pa ng Registrar Staff ang iyong student records. Pinoproseso ang mga accounts tuwing office hours (Lunes hanggang Biyernes, 8:00 AM – 5:00 PM).`
            : `If your account registration is pending approval, Registrar Staff are currently verifying your student records. Accounts are processed during office hours (Mon–Fri, 8:00 AM – 5:00 PM).`;
        } else if (q.includes('contact') || q.includes('office') || q.includes('location') || q.includes('help')) {
          assistantResponse = userIsTagalog
            ? `Maaari mong bisitahin ang GCT Registrar's Office sa campus (Lunes hanggang Biyernes, 8:00 AM – 5:00 PM) para sa direktang tulong sa enrollment at student ID verification.`
            : `You can visit the GCT Registrar's Office on campus (Monday to Friday, 8:00 AM – 5:00 PM) for direct enrollment assistance and student ID verification.`;
        } else {
          assistantResponse = userIsTagalog
            ? `Maligayang pagdating sa Garcia College of Technology!\n\nAko ang iyong GCT AI Assistant. Bilang bisita, masasagot ko ang mga pangkalahatang katanungan ukol sa pagpaparehistro ng estudyante, degree programs, at mga hakbang sa enrollment.\n\n*Tandaan: Para sa mga rekord ng estudyante, marka, at subject recommendations, pakisuyong mag-log in muna.*`
            : `Welcome to Garcia College of Technology!\n\nI am your GCT AI Assistant. As an unauthenticated visitor, I can answer general questions about student registration, degree programs, and enrollment steps.\n\n*Note: For student records, grades, and subject recommendations, please log in first.*`;
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

RECENT CONVERSATION HISTORY (FOR MULTI-TURN RECALL & CONTINUITY):
${formattedHistory || 'No previous messages in this session.'}

CONVERSATION CONTINUITY & RECALL DIRECTIVE:
- When the Registrar sends a message that continues a prior thought, was sent before finishing typing, or uses pronouns/follow-ups (e.g. "kanya", "ito", "pala", "ano pa", "next semester"), RECALL the recent context above and seamlessly respond with full awareness of the conversation.

USER MESSAGE: "${query}"

Instructions:
- Directly, politely, and helpfully reply to the user's message.
- Answer in the same language as the user (English default; Tagalog/Taglish if user spoke Tagalog).
- Be conversational and answer whatever question they asked about GCT.`;
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
        systemPrompt = `You are the official GCT AI Academic Advising Assistant for Garcia College of Technology.
User: ${userName} (Logged-in Student).
The student asked an official institutional FAQ about Garcia College of Technology.
Official GCT Institutional Fact:
${faqMatch}

${GCT_FAQS_CONTEXT_BLOCK}

PRIMARY LANGUAGE DIRECTIVE:
Answer in ${userIsTagalog ? 'Tagalog / Filipino' : 'English'}.
Strictly follow the zero emojis rule.
Answer accurately according to the official GCT facts provided above.

USER MESSAGE: "${query}"`;
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
        const { data: students } = await supabase
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

        const { records, recommendations } = await getStudentRecordsAndRecs(studentInfo, supabase);
        const activeTerm = await getActiveAcademicTerm(supabase);
        const { passedUnits, failedUnits, passedCount, failedCount, gwa } = calculateStudentStats(records);
        const failedSubjectsList = records.filter(r => r.status === 'failed');

        const passedSubjectsStr = records
          .filter(r => r.status === 'passed')
          .map(r => `• ${r.code} (${r.title}) — Grade: ${r.grade} [Passed]`)
          .join('\n') || 'None recorded yet';

        const failedSubjectsStr = records
          .filter(r => r.status === 'failed')
          .map(r => `• ${r.code} (${r.title}) — Grade: ${r.grade} [Failed/Retake]`)
          .join('\n') || 'None';

        const approvedRecs = recommendations.filter(r => r.status === 'approved');
        const approvedRecsStr = approvedRecs.length > 0
          ? approvedRecs.map(r => {
              let parsed = r.generated_subjects;
              try { if (typeof parsed === 'string') parsed = JSON.parse(parsed); } catch (e) {}
              if (Array.isArray(parsed)) {
                return parsed.map(s => `• ${s.code || s.subject_code} (${s.title || s.subject_title || ''}) [${s.units || 3} units]`).join('\n');
              }
              return 'Approved subjects available in Advising Slip.';
            }).join('\n')
          : 'Pending Registrar review & approval.';

        // Detect requested file format (word, excel, text, pdf)
        const requestedFormat = detectRequestedFileFormat(query);
        let fileData = '';
        let filename = '';
        let fileLabel = '';

        if (requestedFormat === 'word') {
          fileData = generateStudentWord(studentInfo, records, gwa);
          filename = `${studentInfo.student_id}_My_Academic_Record.doc`;
          fileLabel = `Download My Academic Record (Word Document)`;
        } else if (requestedFormat === 'text') {
          fileData = generateStudentText(studentInfo, records, gwa);
          filename = `${studentInfo.student_id}_My_Academic_Record.txt`;
          fileLabel = `Download My Academic Record (Text File)`;
        } else {
          fileData = generateStudentCsv(studentInfo, records, gwa);
          filename = `${studentInfo.student_id}_My_Academic_Record.csv`;
          fileLabel = `Download My Academic Record (Excel Spreadsheet)`;
        }

        fileExport = {
          filename,
          format: requestedFormat,
          csv_data: fileData,
          data: fileData,
          label: fileLabel
        };

        const termAnalysis = extractTargetTermAndSemester(query, studentInfo.year_level || studentInfo.year);

        studentAction = {
          student_id: studentInfo.student_id,
          student_name: userName,
          program: studentInfo.program,
          target_term: termAnalysis.target_term || undefined,
          semester: termAnalysis.semester || undefined,
          year_level: termAnalysis.year || undefined
        };

        const isAskingOpinion = isAskingOpinionQuery(query);
        const opinionSection = generateStudentOpinion(
          studentInfo,
          { totalUnits: passedUnits + failedUnits, passedUnits, failedUnits, passedCount, failedCount, gwa },
          records,
          failedSubjectsList,
          userIsTagalog
        );

        systemPrompt = `You are the official GCT AI Academic Advising Assistant for Garcia College of Technology.
Logged-in Student: ${userName} (Student ID: ${studentInfo.student_id})
Program: ${studentInfo.program} - Year ${studentInfo.year_level || 1} (${studentInfo.schedule || studentInfo.section || 'Regular'})
Cumulative GWA: ${gwa}
Passed: ${passedCount} subjects (${passedUnits} units)
Failed/Retakes: ${failedCount} subjects
Current academic term: ${activeTerm ? `${activeTerm.academicYear}, semester ${activeTerm.semester}` : 'Not configured in system settings'}
Grades recorded for current term: ${activeTerm && hasRecordForAcademicTerm(records, activeTerm.academicYear, activeTerm.semester) ? 'Yes' : 'No'}
PASSED:
${passedSubjectsStr}
FAILED:
${failedSubjectsStr}
APPROVED RECOMMENDATIONS:
${approvedRecsStr}

PRIMARY LANGUAGE DIRECTIVE:
- Your PRIMARY and DEFAULT language is ENGLISH. Always communicate in professional, clear, and structured English by default.
- MANDATORY EXCEPTION: If the user communicates in Tagalog (or Taglish/Filipino), you MUST reply in fluent, natural, and encouraging Tagalog/Taglish.
- STRICT ZERO EMOJIS RULE: Under no circumstances should you include emojis or decorative smiley symbols. Keep the reply clean and elegant.
- SCOPE RESTRICTION: You are STRICTLY an academic assistant for Garcia College of Technology (GCT) Subject Assessment and Recommendation System. If the user asks about anything outside of GCT (e.g., weather, sports, general trivia, cooking, news), politely apologize and state that it is outside your scope because you are exclusively for the GCT Subject Assessment and Recommendation System.
- ACADEMIC ADVISING OPINIONS: When the student asks for your opinion, advice, or evaluation (e.g. "ano sa tingin mo", "what is your opinion", "should I...", "advice"), provide a structured, encouraging, yet honest academic opinion based on their verified grades, GWA, prerequisite chains, and curriculum rules.

USER MESSAGE: "${query}"

Instructions:
- Directly, politely, and conversationally reply to the student's exact message or question.
- If they asked to generate a file (Word, Excel, CSV, or Text), confirm that their requested ${requestedFormat.toUpperCase()} file has been generated and is ready to download below!
- If they ask about their grades, GWA, prerequisites, or advice, explain clearly using the verified facts above.
- Do not infer year promotion or enrollment eligibility from cumulative passed-subject counts alone. Confirm active-term grades and required curriculum/prerequisite completion first.
- Language Rule: Reply in English by default; reply in Tagalog if the student wrote in Tagalog.`;

        if (isAskingOpinion) {
          assistantResponse = userIsTagalog
            ? `Hello po, **${userName}**! Narito ang aking opisyal na academic advising opinion at pagsusuri sa iyong academic standing:\n\n${opinionSection}\n\n**Kasalukuyang Buod ng Academic Standing:**\n- **Student ID:** \`${studentInfo.student_id}\`\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Track)'}**\n\n*Gamitin ang mga pindutan sa ibaba upang i-download ang iyong academic record o konsultahin ang iyong advising slip.*`
            : `Hello **${userName}**! Here is my academic advising opinion regarding your standing:

${opinionSection}

**Current Academic Summary:**
- **Student ID:** \`${studentInfo.student_id}\`
- **Cumulative GWA:** **${gwa}**
- **Passed Units:** **${passedUnits}** units (${passedCount} subjects)
- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Track)'}**

*Use the buttons below to download your complete academic record or consult your full advising matrix.*`;
        } else if (/\b(hi|hello|hey|kumusta|kamusta|good\s*morning|good\s*afternoon|good\s*evening)\b/i.test(query)) {
          assistantResponse = userIsTagalog
            ? `Hello po, **${userName}**! Kumusta ka?

Ako ang iyong opisyal na **GCT Academic Advising Assistant**. Narito ang mabilisang buod ng iyong academic standing:
• **Student ID:** \`${studentInfo.student_id}\`
• **Program:** ${studentInfo.program} (Year ${studentInfo.year_level || 1})
• **Cumulative GWA:** **${gwa}**
• **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)
${failedCount > 0 ? `• **Retakes Needed:** ${failedCount} subject(s)\n` : '• **Standing:** Regular / Good Standing\n'}
Maaari mo akong tanungin tungkol sa iyong mga marka, susunod na subjects na dapat kunin, opinyon sa iyong schedule at standing, o mag-download ng iyong record sa **Excel (.csv)**, **Word (.doc)**, o **Text (.txt)** gamit ang buttons sa ibaba!`
            : `Hello, **${userName}**! How can I assist your academic advising today?

I am your official **GCT Academic Advising Assistant**. Here is a quick summary of your academic standing:
• **Student ID:** \`${studentInfo.student_id}\`
• **Program:** ${studentInfo.program} (Year ${studentInfo.year_level || 1})
• **Cumulative GWA:** **${gwa}**
• **Passed Units:** **${passedUnits}** units (${passedCount} subjects)
${failedCount > 0 ? `• **Retakes Needed:** ${failedCount} subject(s)\n` : '• **Standing:** Regular / Good Standing\n'}
You can ask me about your grades, upcoming subject recommendations, evaluation opinions, or download your complete academic record in **Excel (.csv)**, **Word (.doc)**, or **Text (.txt)** using the buttons below!`;
        } else {
          assistantResponse = userIsTagalog
            ? `Hello po, **${userName}**! Narito ang iyong verified academic standing:\n\n- **Student ID:** \`${studentInfo.student_id}\`\n- **Program & Taon:** ${studentInfo.program} - Year ${studentInfo.year_level || 1} (${studentInfo.schedule || studentInfo.section || 'Regular'})\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Deficiencies / Retakes:** ${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Track)'}\n\n**Buod ng Naipasang Subjects:**\n${passedSubjectsStr}\n\n${failedCount > 0 ? `**Mga Subject na Kailangang I-retake:**\n${failedSubjectsStr}\n\n` : ''}**Naaprubahang Rekomendasyon sa Susunod na Termino:**\n${approvedRecsStr}\n\n*Maaari mong i-download ang iyong kumpletong rekord bilang ${requestedFormat.toUpperCase()} file sa ibaba.*`
            : `Hello **${userName}**! Here is your verified academic standing:

- **Student ID:** \`${studentInfo.student_id}\`
- **Program & Year:** ${studentInfo.program} - Year ${studentInfo.year_level || 1} (${studentInfo.schedule || studentInfo.section || 'Regular'})
- **Cumulative GWA:** **${gwa}**
- **Passed Units:** **${passedUnits}** units (${passedCount} subjects)
- **Deficiencies / Retakes Needed:** ${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Track)'}

**Passed Subjects Summary:**
${passedSubjectsStr}

${failedCount > 0 ? `**Subjects Needing Retake:**\n${failedSubjectsStr}\n\n` : ''}**Approved Next Term Recommendations:**
${approvedRecsStr}

*You can download your complete academic record as a ${requestedFormat.toUpperCase()} file below.*`;
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

    // =========================================================================
    // 3. ADMIN & REGISTRAR STAFF ROLE CHATBOT LOGIC
    // Has full access to ALL students!
    // Generates downloadable CSV/Excel and direct links to Academic Records & Recommendations!
    // =========================================================================
    else {
      // Check if querying a specific student by ID or Name
      const targetStudent = await findTargetStudent(query, supabase, history);

      if (targetStudent) {
        // Specific student found! Fetch their full records and generate requested file format
        const { records, recommendations } = await getStudentRecordsAndRecs(targetStudent, supabase);
        const { totalUnits, passedUnits, failedUnits, passedCount, failedCount, gwa } = calculateStudentStats(records);
        const cleanId = String(targetStudent.student_id || targetStudent.id || 'Student').replace(/^GCT-/i, '').trim();

        // Detect requested file format (word, excel, text, pdf)
        const requestedFormat = detectRequestedFileFormat(query);
        let fileData = '';
        let filename = '';
        let fileLabel = '';

        if (requestedFormat === 'word') {
          fileData = generateStudentWord(targetStudent, records, gwa);
          filename = `${cleanId}_Academic_Record.doc`;
          fileLabel = `Download ${cleanId} Record (Word Document)`;
        } else if (requestedFormat === 'text') {
          fileData = generateStudentText(targetStudent, records, gwa);
          filename = `${cleanId}_Academic_Record.txt`;
          fileLabel = `Download ${cleanId} Record (Text File)`;
        } else {
          fileData = generateStudentCsv(targetStudent, records, gwa);
          filename = `${cleanId}_Academic_Record.csv`;
          fileLabel = `Download ${cleanId} Record (Excel Spreadsheet)`;
        }

        fileExport = {
          filename,
          format: requestedFormat,
          csv_data: fileData,
          data: fileData,
          label: fileLabel
        };

        const termAnalysis = extractTargetTermAndSemester(query, targetStudent.year_level || targetStudent.year);

        studentAction = {
          student_id: targetStudent.student_id,
          student_name: targetStudent.name || targetStudent.full_name,
          program: targetStudent.program,
          target_term: termAnalysis.target_term || undefined,
          semester: termAnalysis.semester || undefined,
          year_level: termAnalysis.year || undefined
        };

        const recordsBreakdown = records.length > 0
          ? records.map(r => `| \`${r.code}\` | ${r.title} | ${r.units} | **${r.grade != null ? r.grade : 'N/A'}** | ${r.status === 'passed' ? 'Passed' : 'Failed'} | ${r.term} |`).join('\n')
          : '| N/A | No records encoded in database yet | 0 | N/A | N/A | N/A |';

        let recStatus = 'Direct automated assessment active (no manual review required).';

        const isAskingOpinion = isAskingOpinionQuery(query);
        const registrarOpinion = generateRegistrarOpinion(
          targetStudent,
          { totalUnits, passedUnits, failedUnits, passedCount, failedCount, gwa },
          records,
          failedCount,
          userIsTagalog
        );

        systemPrompt = `You are the GCT Registrar Operations Assistant.
User: ${userName} (Registrar Operations)
Provide a complete, professional, comprehensive academic assessment of student:
Name: ${targetStudent.name || targetStudent.full_name}
Student ID: ${targetStudent.student_id}
Program: ${targetStudent.program} - Year ${targetStudent.year_level || targetStudent.year || 1}
GWA: ${gwa}
Passed: ${passedUnits} units (${passedCount} subjects)
Failed: ${failedUnits} units (${failedCount} subjects)
Recommendations: ${recStatus}

Detailed Grades Breakdown:
${recordsBreakdown}

PRIMARY LANGUAGE DIRECTIVE:
- Your PRIMARY and DEFAULT language is ENGLISH. Always communicate in professional, clear, and structured English by default.
- MANDATORY EXCEPTION: If the user communicates in Tagalog (or Taglish/Filipino), you MUST reply in fluent, natural Tagalog/Taglish.
- STRICT ZERO EMOJIS RULE: Under no circumstances should you include emojis or decorative smiley symbols. Keep the reply clean, structured, and elegant.
- SCOPE RESTRICTION: You are STRICTLY an assistant for the Garcia College of Technology (GCT) Subject Assessment and Recommendation System. If the query is unrelated, politely apologize and state that it is outside your scope.
- REGISTRAR EVALUATION OPINIONS: When the registrar or staff asks for your opinion or evaluation on this student, provide a formal, analytical academic evaluation covering prerequisite compliance, curriculum progression risks, and concrete advising recommendations.

USER MESSAGE: "${query}"

Instructions:
- Directly, professionally, and comprehensively reply to the Registrar's specific message or question.
- If they asked to generate a file (Word, Excel, CSV, Text), confirm that their requested ${requestedFormat.toUpperCase()} file has been generated and is ready to download below!
- Mention that interactive buttons below will open this student's profile directly in Academic Records or Subject Recommendations.
- Language Rule: Reply in English by default; reply in Tagalog if the user wrote in Tagalog.`;

        if (isAskingOpinion) {
          assistantResponse = userIsTagalog
            ? `### Pagsusuri at Opinyon: **${targetStudent.name || targetStudent.full_name}**\n\n${registrarOpinion}\n\n#### Buod ng Academic Record:\n- **Student ID:** \`${targetStudent.student_id}\`\n- **Program & Taon:** ${targetStudent.program} — Year ${targetStudent.year_level || targetStudent.year || 1}\n- **Cumulative GWA:** **${gwa}**\n- **Naipasang Units:** **${passedUnits}** units (${passedCount} subjects)\n- **Deficiencies:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Track)'}**\n- **Status ng Rekomendasyon:** ${recStatus}\n\n*Gamitin ang buttons sa ibaba upang buksan ang profile ng estudyanteng ito sa Academic Records o Subject Recommendations, o i-download ang kumpletong ulat bilang ${requestedFormat.toUpperCase()} file.*`
            : `### Evaluation & Opinion: **${targetStudent.name || targetStudent.full_name}**

${registrarOpinion}

#### Academic Record Summary:
- **Student ID:** \`${targetStudent.student_id}\`
- **Program & Year:** ${targetStudent.program} — Year ${targetStudent.year_level || targetStudent.year || 1}
- **Cumulative GWA:** **${gwa}**
- **Passed Units:** **${passedUnits}** units (${passedCount} subjects)
- **Deficiencies:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Track)'}**
- **Recommendation Status:** ${recStatus}

*Use the buttons below to open this student's profile in Academic Records or Subject Recommendations, or download the complete report as a ${requestedFormat.toUpperCase()} file.*`;
        } else {
          assistantResponse = userIsTagalog
            ? `### Academic Record ng Estudyante: **${targetStudent.name || targetStudent.full_name}**\n\n- **Student ID:** \`${targetStudent.student_id}\`\n- **Program & Taon:** ${targetStudent.program} — Year ${targetStudent.year_level || targetStudent.year || 1} (${targetStudent.schedule || targetStudent.section || 'Schedule 1'})\n- **Cumulative GWA:** **${gwa}**\n- **Nakumpletong Units:** **${passedUnits}** units (${passedCount} passed subjects)\n- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'Wala (Regular Track)'}**\n- **Status ng Rekomendasyon:** ${recStatus}\n\n#### Kumpletong Grade Sheet:\n| Subject Code | Deskripsyon | Units | Marka | Katayuan | Termino |\n| :--- | :--- | :---: | :---: | :---: | :--- |\n${recordsBreakdown}\n\n---\n*Gamitin ang action buttons sa ibaba upang i-download ang rekord bilang ${requestedFormat.toUpperCase()} file, o pumunta sa profile ng estudyante sa Academic Records o Subject Recommendations.*`
            : `### Student Academic Record: **${targetStudent.name || targetStudent.full_name}**

- **Student ID:** \`${targetStudent.student_id}\`
- **Program & Year:** ${targetStudent.program} — Year ${targetStudent.year_level || targetStudent.year || 1} (${targetStudent.schedule || targetStudent.section || 'Schedule 1'})
- **Cumulative GWA:** **${gwa}**
- **Completed Units:** **${passedUnits}** units (${passedCount} passed subjects)
- **Deficiencies / Retakes:** **${failedCount > 0 ? `${failedCount} subject(s)` : 'None (Regular Track)'}**
- **Recommendation Status:** ${recStatus}

#### Complete Grade Sheet:
| Subject Code | Description | Units | Grade | Status | Term |
| :--- | :--- | :---: | :---: | :---: | :--- |
${recordsBreakdown}

---
*Use the action buttons below to download this complete record as a ${requestedFormat.toUpperCase()} file, or jump directly to this student's profile in Academic Records or Subject Recommendations.*`;
        }
      } 
      // General institutional inquiry
      else {
        const { data: stData } = await supabase.from('students').select('id, student_id, full_name, program, year_level, schedule, status');
        const allStudents = stData || [];
        const studentCount = allStudents.length;

        const { data: acctData } = await supabase.from('accounts').select('role, status');
        const pendingStudentsCount = (acctData || []).filter(a => a.role === 'student' && a.status === 'pending').length;

        const { data: recData } = await supabase.from('recommendations').select('id').eq('status', 'pending_review');
        const pendingRecsCount = recData?.length || 0;

        const { data: subData } = await supabase.from('subjects').select('id');
        const subjectCount = subData?.length || 10;

        let passingThreshold = 75;
        let maxFailedPrereqs = 3;
        try {
          const { data: setThresh } = await supabase.from('settings').select('value').eq('key', 'passing_grade_threshold').limit(1);
          if (setThresh?.[0]?.value) passingThreshold = Number(setThresh[0].value);
          const { data: setPrereq } = await supabase.from('settings').select('value').eq('key', 'max_failed_prerequisites').limit(1);
          if (setPrereq?.[0]?.value) maxFailedPrereqs = Number(setPrereq[0].value);
        } catch (e) {}

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

          const previewList = allStudents.slice(0, 10).map(s => 
            `• \`${s.student_id || s.id}\` — **${s.name || s.full_name || 'Student'}** (${s.program} Year ${s.year_level || 1})`
          ).join('\n');

          assistantResponse = `### GCT Student Directory Report
The system currently manages **${studentCount}** registered students.

**Directory Preview (First 10 records):**
${previewList}
${allStudents.length > 10 ? `\n*... and ${allStudents.length - 10} more students.*` : ''}

*You can download the complete student list as a ${requestedFormat.toUpperCase()} file using the button below.*`;
        } else if (/\b\d{4,6}\b/.test(query) || /\b(student|record|grades?|profile|evaluation|transcript|show\s+record|search|find|grades\s+of)\b/i.test(query)) {
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
   - Itanong: *"What are the academic threshold rules?"*`
            : `Here are the core operations available for Registrar and Staff:

1. **Student Academic Lookups & Evaluations:**
   - Search by Student ID or surname to view full course history, GWA, earned units, and prerequisites.
   - Request formal advising opinions or assessment summaries for any student.
   - Jump directly to records via interactive shortcuts to **Academic Records** or **Subject Recommendations**.
2. **Multi-Format Report Generation:**
   - Simply ask: *"Generate in Excel"*, *"Export in Word"*, or *"Download as Text"* for printable official archives.
3. **Institutional Governance & Rules:**
   - Ask: *"How many student registrations are pending?"*
   - Ask: *"What are the academic threshold rules?"*`;
        } else if (/\b(magkano|presyo|pricing|cost|bayad|api\s*key|gemini\s*cost)\b/i.test(q)) {
          assistantResponse = userIsTagalog
            ? `Tungkol sa Google Gemini API:
- Ang Google AI Studio ay may **Free Tier** (libreng gamitin para sa trial at development).
- Para sa production gamit ang **Pay-as-you-go (Blended Rate)**, ang Gemini Flash ay napakamura: humigit-kumulang **$0.075 bawat 1 milyong input tokens** (nasa ilang sentimo lamang sa libo-libong chat queries).
- Kung naabot ang daily limit ng free key, awtomatikong gumagana ang built-in GCT database rule engine upang hindi maantala ang serbisyo!`
            : `About the Google Gemini API:
- Google AI Studio provides a generous **Free Tier** suitable for development and operational evaluation.
- For production under **Pay-as-you-go rates**, Gemini Flash is economical at approximately **$0.075 per 1 million input tokens**.
- If quota limits are reached, the system automatically engages the built-in GCT database rule engine to maintain uninterrupted service.`;
        } else if (q.includes('pending') || q.includes('approval') || q.includes('signup')) {
          assistantResponse = userIsTagalog
            ? `### Student Registration Approval Queue
- **Pending Approvals:** **${pendingStudentsCount}** bagong student account ang naghihintay ng verification.
- **Office Governance:** Maaari mong suriin ang mga ID photo, kumpirmahin ang mga detalye, at i-approve o i-reject ang registration sa **User & Account Governance** tab.`
            : `### Student Registration Approval Queue
- **Pending Approvals:** **${pendingStudentsCount}** new student accounts awaiting verification.
- **Office Governance:** You can inspect submitted ID photos, verify student credentials, and approve or reject submissions in the **User & Account Governance** tab.`;
        } else if (q.includes('threshold') || q.includes('prereq') || q.includes('rule') || q.includes('setting')) {
          assistantResponse = userIsTagalog
            ? `### Institutional Academic Rules & Thresholds
- **Minimum Passing Grade Threshold:** **${passingThreshold}%** (katumbas ng Grade 3.00)
- **Maximum Allowed Failed Prerequisites:** **${maxFailedPrereqs}** subjects bago masuspinde ang enrollment
- **Active Academic Year:** 2025–2026 (Semester 1)
*Maaaring baguhin ang mga pamantayan sa System Settings.*`
            : `### Institutional Academic Rules & Thresholds
- **Minimum Passing Grade Threshold:** **${passingThreshold}%** (Grade 3.00 equivalent)
- **Maximum Allowed Failed Prerequisites:** **${maxFailedPrereqs}** subjects before enrollment suspension
- **Active Academic Year:** 2025–2026 (Semester 1)
*Rules can be configured under System Settings.*`;
        } else if (q.includes('queue') || q.includes('recommend') || q.includes('review')) {
          assistantResponse = userIsTagalog
            ? `### Subject Recommendations & Advising
- **Status:** Direktang gumagana ang automated prerequisite evaluation para sa mga estudyante.
- Hindi na kinakailangan ng manual approval queue dahil real-time na kinakalkula ang recommended subjects at retakes batay sa kanilang naipasang prerequisites.`
            : `### Subject Recommendations & Advising
- **Status:** Automated prerequisite evaluation is directly active for students.
- Manual approval review is no longer required as recommended subjects, eligible unlocks, and retakes are computed dynamically in real-time.`;
        } else {
          assistantResponse = userIsTagalog
            ? `Kumusta, **${userName}** (Registrar Operations)!

Ako ang inyong GCT Registrar Operations Assistant na may direktang koneksyon sa database. Maaari mong itanong:
1. **Paghahanap ng record at academic evaluation:** I-type ang Student ID (halimbawa: \`2024-0001\`, \`12718\`) o pangalan ng estudyante upang makita ang buong grado, GWA, advising opinions, at downloadable file.
2. **Direktang pagbubukas ng student profile:** May mabilisang links patungo sa **Academic Records** o **Subject Recommendations**.
3. **Institutional analytics at opisyal na payo:** Magtanong ukol sa pending approvals, failure trends, curriculum compliance, at iba pa.`
            : `Hello **${userName}** (Registrar Operations)!

I am your GCT Registrar Operations Assistant with direct database access. You can ask me to:
1. **Search any student record & evaluation:** Enter a Student ID (e.g. \`2024-0001\`, \`12718\`) or name to review course grades, GWA, advising opinions, and downloadable reports.
2. **Open student records:** Use direct action shortcuts to open their profile in **Academic Records** or **Subject Recommendations**.
3. **Institutional analytics & advice:** Inquire about pending student approvals, curriculum compliance, or request formal advising guidance.`;
        }

        // Set prompt for Gemini to answer the user's specific query directly
        systemPrompt = `You are the GCT Registrar Operations AI Assistant for Garcia College of Technology.
User: ${userName} (Registrar Administrator / Staff).
Database Status:
- Registered Students: ${studentCount}
- Pending Student Account Approvals: ${pendingStudentsCount}
- Minimum Passing Threshold: ${passingThreshold}%
- Maximum Allowed Failed Prerequisites: ${maxFailedPrereqs} subjects
- Subject Advising: Directly automated in real-time (no manual recommendation approval queue required).

PRIMARY LANGUAGE DIRECTIVE:
Your main and default communication language is English.
However, if the user asks or speaks in Tagalog / Taglish (userIsTagalog = ${userIsTagalog}), you MUST respond naturally in Tagalog / Filipino. Otherwise, respond strictly in English.

CRITICAL FORMATTING INSTRUCTIONS:
1. ZERO EMOJIS: Do NOT use any emojis or decorative symbols in your response under any circumstance.
2. SCOPE RESTRICTION: You are STRICTLY an assistant for the Garcia College of Technology (GCT) Subject Assessment and Recommendation System. If the user asks about anything unrelated (such as weather, sports, general trivia, cooking, or general news), politely apologize and state that it is outside your scope because you are exclusively for the GCT Subject Assessment and Recommendation System.
3. REGISTRAR ADVISING OPINIONS: When the registrar or administrator asks for your opinion, advice, or evaluation, provide a professional, structured, and insightful academic evaluation with clear recommendations.

USER MESSAGE: "${query}"

Instructions:
- Directly, specifically, and conversationally reply to what the Registrar messaged or asked.
- Provide accurate operational guidance regarding GCT Registrar tasks, student evaluations, curriculum rules, or reports.
- If they asked to export or download, note that the ${requestedFormat.toUpperCase()} file is ready below.
- Reply in Tagalog if the user used Tagalog; otherwise reply in English as the main language.`;
      }
    }

    // Call Google Gemini API if key is set and quota cooldown is not active
    require('dotenv').config();
    const apiKey = process.env.GEMINI_API_KEY;
    const isGeminiBlocked = Date.now() < geminiQuotaBlockedUntil;

    if (apiKey && apiKey !== 'your-google-gemini-api-key' && systemPrompt && !isGeminiBlocked) {
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
          assistantResponse = stripEmojis(response.text);
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

    // Strictly enforce zero emojis on final response
    assistantResponse = stripEmojis(assistantResponse);

    // Log chat entry in Supabase chat_logs table
    const chatId = 'chat-' + Date.now();
    const now = new Date().toISOString();

    try {
      await supabase.from('chat_logs').insert([{
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
      student_action: studentAction || null
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
  buildEnrollmentEligibilityResponse
};
