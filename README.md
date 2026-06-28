# LifeHub

Aplicație **PWA** (Progressive Web App) rafinată, modernă și fluidă, cu 5 module:

1. **Monitorizare credite** — tipuri predefinite (imobiliar, nevoi personale, auto…), dobândă fixă, **variabilă pe bază de IRCC** (+ marjă) sau **fixă o perioadă, apoi variabilă**, editare/ștergere direct de pe cardul creditului, **plăți în avans** (unealtă care arată pe loc economia înainte de a salva — reduc durata sau rata), **alertă de actualizare IRCC** (când se schimbă trimestrul aplicabil), **grafic IRCC interactiv** (zoom in/out, derulare, hover) cu **tabel de editare** (butonul *Editează IRCC* → adaugă/editează trimestre, cu săgeți de tendință, salvate în `ircc.json` și incluse în backup), rată lunară (cu mini pie principal/dobândă), sold rămas, **grafic interactiv al ratei lunare** (bare stivuite principal + dobândă, cu detalii la hover/touch, derulare în timp și zoom pe lună/trimestru/semestru/an), **tabel cu toate ratele lunare** (anterioare și viitoare, cu împărțire principal/dobândă) și statistici de economii (canvas).
2. **Notițe & To-Do** — notițe colorate, fixare, liste de sarcini bifabile, căutare.
3. **Rețete de gătit** — carduri cu ingrediente, pași, categorii, favorite.
4. **Statistici cheltuieli** — donut pe categorii, evoluție lunară (bare), tendință, listă tranzacții — totul pe **canvas**.
5. **Economii** — obiective cu inel de progres (canvas), depuneri/retrageri, termene.

Plus un **dashboard** de ansamblu pe pagina *Acasă*.

## Caracteristici

- ✅ **Instalabilă** pe telefon și desktop — rulează în fereastră proprie, fără bara browserului.
- ✅ **Offline-first** — funcționează fără internet (service worker + cache).
- ✅ **Grafice pe canvas** — donut, bare, linie/arie, inele de progres, toate animate și high-DPI.
- ✅ **Date locale** — totul e salvat pe dispozitiv (localStorage), cu **export/import backup** (`.json`).
- ✅ **Temă** luminoasă (implicită) / întunecată.
- ✅ **Monedă de afișare** RON (implicit) sau EUR (conversie doar pentru vizualizare; datele rămân în RON).
- ✅ **Responsive** — sidebar pe desktop, bară de navigare jos + buton „+” pe mobil.
- ✅ **Zero dependențe** la runtime (vanilla JS, ES modules). Node e folosit doar pentru server local și generarea iconițelor.

## Rulare locală

Necesită Node.js (testat pe v24).

```bash
npm start
# sau:  node tools/serve.js 5173
```

Apoi deschide **http://localhost:5173**.

> Aplicația trebuie servită prin HTTP (nu deschisă direct ca `file://`), pentru că folosește ES modules și service worker.

## Instalare ca aplicație

### Pe desktop (Windows / Mac — Chrome sau Edge)
1. Deschide http://localhost:5173
2. Apasă butonul **„Instalează”** din bannerul de pe pagina *Acasă*, sau iconița de instalare din bara de adrese.
3. Aplicația se deschide într-o fereastră proprie, ca o aplicație nativă.

### Pe telefon (Android / iPhone)
Pentru ca telefonul să o poată instala, aplicația trebuie servită prin **HTTPS** (cerință PWA). `localhost` de pe PC nu e accesibil direct de pe telefon, deci publică folderul pe un host static gratuit:

- **Netlify Drop** — trage folderul `LifeHub` în https://app.netlify.com/drop
- **Vercel** — `npx vercel` în folder
- **GitHub Pages** — urcă folderul într-un repo și activează Pages

Apoi, de pe telefon, deschide adresa HTTPS și:
- **Android (Chrome):** meniu ⋮ → *Adaugă la ecranul principal* / *Instalează aplicația*.
- **iPhone (Safari):** butonul *Share* → *Adaugă pe ecranul principal*.

După instalare, se deschide pe tot ecranul, **fără Chrome/Safari în jur**.

## Structura proiectului

```
LifeHub/
├─ index.html               # app shell
├─ manifest.webmanifest     # config PWA (instalare)
├─ sw.js                    # service worker (offline)
├─ css/styles.css           # sistemul de design
├─ js/
│  ├─ app.js                # router, temă, instalare, backup
│  ├─ store.js              # date (localStorage) + funcții financiare
│  ├─ charts.js             # grafice pe canvas
│  ├─ ui.js                 # iconițe, modale, toast, formatare
│  └─ modules/              # dashboard, credits, notes, recipes, stats, savings
├─ icons/                   # iconițe PNG generate
├─ data_storage/            # datele tale (JSON per modul) — creat la prima rulare
└─ tools/                   # server local (+ API fișiere) și generator de iconițe
```

## Unde se salvează datele

Stocarea e **hibridă**, aleasă automat:

### Desktop — fișiere editabile manual
Când aplicația rulează prin serverul local (`npm start`), datele se citesc și se scriu în:

```
E:\my_proj\life_hub\LifeHub\data_storage\
├─ credits.json
├─ notes.json
├─ recipes.json
├─ expenses.json
├─ savings.json
└─ ircc.json          # valori IRCC pe trimestre (referință)
```

- Câte un fișier JSON per modul, formatat lizibil → **editabil manual** cu orice editor de text.
- `ircc.json` sunt valorile IRCC pe trimestre. IRCC-ul aplicabil într-un trimestru e cel de acum 2 trimestre (ex. Q2 2026 → 2025T4). Le poți edita fie manual în fișier, fie direct din aplicație: în *Credite*, butonul **Editează IRCC** de pe cardul IRCC deschide un tabel unde adaugi trimestrul următor sau editezi/ștergi valori — modificările se scriu înapoi în `ircc.json` (printr-un endpoint dedicat, separat de salvarea normală a datelor). O salvare obișnuită de date nu atinge niciodată acest fișier. Valorile sunt incluse și în Export/Import backup.
- Fișierele sunt **sursa de adevăr**: la pornire aplicația le citește, iar la fiecare modificare le rescrie.
- Folderul și fișierele demo se creează automat la prima rulare.

**Editare manuală:** modifică fișierul, apoi în aplicație *Date → „Reîncarcă din fișiere”* (sau dă refresh). Dacă editezi un fișier în timp ce aplicația e deschisă și apoi faci o modificare în UI, UI-ul rescrie fișierul — așa că reîncarcă întâi dacă ai editat manual.

### Mobile — stocare privată persistentă
Pe telefon, un PWA nu poate scrie într-un folder din sistemul de fișiere accesibil manual (restricție de securitate). Datele se păstrează în **stocarea privată persistentă a aplicației** (marcată cu `navigator.storage.persist()` ca să nu fie ștearsă automat). Pentru editare/mutare manuală pe mobil folosește **Export/Import** (`.json`).

## Backup

*Acasă → meniu lateral → „Date”* → **Exportă backup** (descarcă `.json`) sau **Importă backup**.
Acesta e și modul de mutare a datelor între desktop și telefon. Datele demo pot fi reîncărcate cu **Resetează datele**.
