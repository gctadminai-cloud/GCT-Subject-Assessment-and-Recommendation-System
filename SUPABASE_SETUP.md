# GCT Supabase Setup (para sa ByteMe app)

## Bakit hindi gumagana dati
1. **Dalawa ang magkaibang system** sa zip files niyo. Ang `ByteMe` ay gumagamit ng sarili niyang `accounts` table + bcrypt + JWT. Ang `gct-supabase-seed` ay gumagamit ng *Supabase Auth*. **Hindi sila compatible** — gamitin lang ang ByteMe approach, huwag i-run ang `gct-supabase-seed`.
2. Ang `backend/config/supabase.js` ay **tahimik na lumilipat sa fake in-memory database** kapag may mali sa .env (o `NODE_ENV=test`). Mukhang gumagana ang app pero walang nase-save sa Supabase.
3. Hindi pa na-run ang schema at hindi pa na-seed ang data.

## Mga steps (isang beses lang)

**1. Schema setup:** Sa bagong empty Supabase project lang patakbuhin ang `supabase/01_schema.sql`. May `DROP TABLE ... CASCADE` ito at buburahin ang existing data kapag ni-run sa populated project. Para sa existing project, huwag itong patakbuhin; gamitin ang non-destructive na `supabase/02_lock_down_public_access.sql` para sa RLS lockdown.

**2. I-copy ang folder `backend/scripts/` ng zip na ito papunta sa `ByteMe/backend/scripts/`** (idadagdag lang: `seedAll.js`, `verifyDb.js`, `data/`).

**3. Check ang `ByteMe/backend/.env`:**
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key, hindi anon>
JWT_SECRET=<unique random secret, at least 32 characters>
GMAIL_USER=<Gmail sender address>
GMAIL_APP_PASS=<Google App Password>
FRONTEND_URL=https://<deployed-frontend-domain>
```
(Supabase → Project Settings → API. Gumamit ng Google App Password para sa Gmail.)

**4. Gumawa ng private Storage bucket para sa verification images:**
- Supabase → Storage → New bucket → pangalan: `student-verifications`.
- Iwanang **Private**; itakda ang maximum file size sa **5 MB** at allowed MIME types sa `image/jpeg`, `image/png`.
- Backend lang ang nag-a-upload gamit ang service-role key. Huwag magdagdag ng public read policy; Registrar access ay signed URL.

**5. Seed:**
```bash
cd ByteMe/backend
npm install
node scripts/seedAll.js --dry-run   # test lang ng data, walang DB
node scripts/seedAll.js             # totoong seed
node scripts/verifyDb.js            # kumpirmahin na nandun na lahat
```
Expected sa verify: students 250 · bulk_imported accounts 250 · registrar accounts 2 · grade_records 11374 · needs_review 265 · login 10094/bhcwQ OK.

**6. Takbuhin ang app:** `npm start` sa backend, `npm run dev` sa frontend. Mag-login gamit ang ID Number + password mula sa Excel (hal. `10094` / `bhcwQ`). Admin: `registrar_admin` / `AdminGCT2026!` (o kung ano nasa .env niyo — palitan agad).

## Ano ang nasa Supabase pagkatapos
| Excel | Table | Laman |
|---|---|---|
| USERS_updated (250) | `students`, `accounts`, `profiles` | original password (bcrypt-hashed), `bulk_imported = true`, `verified = true`, year level galing sa pinakabagong grades |
| ALL_GRADES (11,374 rows) | `grade_records` | lahat ng rows, kasama ang original na grade text (`raw_grade`) |
| — | `accounts`/`profiles` | Registrar Admin at Staff |

Weekly reset: ang cron ng ByteMe (`cron/weeklyReset.js`, Lunes 12:00 AM) ay nagpapadala muna ng email sa bawat student account na `bulk_imported = false`, kasama ang link para mag-register ulit. Kapag may kulang na email o pumalya ang pagpapadala, kakanselahin ang reset. Kapag matagumpay ang email delivery, saka buburahin ang accounts; mananatili ang permanent student records at photos. Tumatakbo lang ito habang naka-on ang backend server.

## Mga problema sa Excel data (kailangan niyong i-decide)
- **265 grade rows ang naka-flag `needs_review = true`** at `grade = NULL` (nasa `raw_grade` pa rin ang original): `9` (239 rows, kasama ang units na `-`, mukhang code para sa walang grade), `-` (11), blanks (9), `0.75` (2), at tig-isa ang `23`, `25`, `14.75`, `2.35`. Hindi ko hinulaan ang tamang grade para hindi magkamali ang pass/fail. Ayusin sa Supabase Table Editor o sa Excel, tapos i-seed ulit.
- **Awtomatikong inayos (5 rows):** `1.753`→1.75, `2.252` at `2.2532`→2.25, `.2.5`→2.5, `1 .5`→1.5. Subject names `Rizal.1` / `Rizal1` ay ginawang `Rizal 1`.
- **277 students sa grades ay wala sa USERS file** (526 sa grades vs 250 accounts). Nasa `grade_records` ang grades nila pero wala silang `students` row/account — sinadya, para hindi sila ma-treat na "verified" nang walang ID photo. Lalabas ang grades nila kapag nag-register sila.
- 1 student sa USERS ang walang grades (year level = 1 default).
- Walang **subjects/prerequisites** sa Excel files, kaya walang laman ang `subjects`/`prerequisites`. Ang records page ay kumukuha sa `grade_records` kapag walang `academic_records`, pero ang Assessment Engine ay kailangan ng curriculum at prerequisites — kailangan niyo itong ilagay (Admin → Curriculum).
- Ang app ay gumagamit ng passing threshold na 50/75 sa settings pero ang grades ay 1.0–5.0 scale (mas mababa = mas mataas). Ang records page ay tama (`<= 3.0` = passed); pero i-check ang assessment engine kung gagamitin ito.

## Security
- Huwag kailanman i-commit ang `backend/.env`, service-role key, Gmail app password, o JWT secret. Gumamit ng deployment secret manager; i-rotate agad ang anumang key na naibahagi.
- Para sa existing Supabase project, patakbuhin ang `supabase/02_lock_down_public_access.sql` sa SQL Editor pagkatapos tiyaking naka-configure ang service-role key sa backend. Tinatanggal nito ang public policies at table grants sa `anon`/`authenticated`; walang direct Supabase client sa frontend ang app.
- Ang backend ay nangangailangan ng unique `JWT_SECRET` na hindi bababa sa 32 characters sa staging/production. Gumawa ng cryptographically random value gamit ang `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` at ilagay ito sa hosting secret manager bilang `JWT_SECRET` (huwag i-commit sa Git). Kapag nag-rotate ng secret, mawawalan ng bisa ang kasalukuyang JWT sessions at kailangang mag-login muli ang mga user.
- Huwag mag-deploy publicly hangga't hindi naia-apply at nave-verify ang RLS migration at napapalitan ang deployment secrets.
