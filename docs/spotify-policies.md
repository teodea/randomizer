# Policy Spotify for Developers: note di riferimento per Randomizer

**Data di verifica:** 2026-09-18
**Contesto:** web app personale (proprietario Premium + massimo 4 amici), Development Mode, Client ID creato intorno al 2022 (quindi "esistente"). Legge le playlist dell'utente e i Brani che ti piacciono, genera un mix, lo scrive in UNA playlist temporanea, avvia la riproduzione e poi rimuove la playlist. Eventuali preset in localStorage. Nessuno scopo commerciale.

**Legenda affidabilità**
- **[FONTE]**: confermato leggendo la pagina ufficiale (parafrasi mia, citazioni di poche parole).
- **[INTERPRETAZIONE]**: mia lettura o deduzione, non scritta esplicitamente nella fonte.
- **Numeri di sezione:** le pagine sono state lette con uno strumento di estrazione testo. Le sezioni citate sono quelle che risultano dal testo estratto. Dove due letture hanno dato numerazioni diverse (es. `IV.2.1.a` e `IV.2.1.1`), lo segnalo. Prima di citarle in un documento formale vanno ricontrollate a mano.

---

## 1. Fonti consultate

| # | Documento | URL | Data del documento |
|---|---|---|---|
| S1 | Developer Terms | https://developer.spotify.com/terms | Versione 10, in vigore dal 15 maggio 2025 |
| S2 | Developer Policy | https://developer.spotify.com/policy | In vigore dal 15 maggio 2025 |
| S3 | Design & Branding Guidelines | https://developer.spotify.com/documentation/design | Nessuna data visibile |
| S4 | Compliance Tips | https://developer.spotify.com/compliance-tips | Nessuna data visibile |
| S5 | Quota modes | https://developer.spotify.com/documentation/web-api/concepts/quota-modes | Nessuna data di pagina (cita i criteri del 15 maggio 2025) |
| S6 | Redirect URI | https://developer.spotify.com/documentation/web-api/concepts/redirect_uri | Nessuna data di pagina (cita il 9 aprile 2025 e novembre 2025) |
| S7 | Authorization Code with PKCE | https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow | Nessuna data visibile |
| S8 | Refreshing tokens | https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens | Nessuna data visibile |
| S9 | Scopes | https://developer.spotify.com/documentation/web-api/concepts/scopes | Nessuna data visibile |
| S10 | Rate limits | https://developer.spotify.com/documentation/web-api/concepts/rate-limits | Nessuna data visibile |
| S11 | Guida alla migrazione di febbraio 2026 | https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide | Nessuna data di revisione (cita l'aggiornamento di luglio 2026) |
| S12 | Changelog di febbraio 2026 | https://developer.spotify.com/documentation/web-api/references/changes/february-2026 | Febbraio 2026 |
| S13 | Changelog di marzo 2026 | https://developer.spotify.com/documentation/web-api/references/changes/march-2026 | Marzo 2026 |
| S14 | Changelog di maggio 2026 | https://developer.spotify.com/documentation/web-api/references/changes/may-2026 | Maggio 2026 |
| S15 | Blog "Update on Developer Access and Platform Security" | https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security | 6 febbraio 2026, aggiornato il 9 marzo 2026 |
| S16 | Blog "Introducing refresh token expiration" | https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration | 18 giugno 2026 |
| S17 | Blog "Web API quota updates for Development Mode" | https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates | 23 luglio 2026 |
| S18 | Riferimenti degli endpoint: Create Playlist, Get Playlist Items, Remove Library Items, Get Saved Tracks, Start Playback | developer.spotify.com/documentation/web-api/reference/... | Nessuna data visibile |

---

## 2. Regole per area

### 2.1 Nome e dominio

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Il nome dell'app non deve iniziare con "Spot" né somigliare a "Spotify" nel suono o nella grafia. | S2, sez. VI (Naming and Branding) | [FONTE] | "Randomizer" è consentito. Evitare nomi come "Spotimix" o "Shuffify". |
| Non usare i marchi Spotify nel nome dell'azienda o del servizio e non registrare marchi confondibili. | S1, sez. IV.2.3.2 (numerazione da estrazione) | [FONTE] | Il dominio non deve contenere "spotify" (es. `randomizer-spotify.app` è vietato). "for Spotify" nel nome è sconsigliato. |
| Non far pensare a un'approvazione, una partnership o un co-branding di Spotify. | S2, sez. II e VI; S1, sez. III.1.3 / IV.2.3 | [FONTE] | Nessun testo del tipo "app ufficiale" o "in collaborazione con Spotify". |
| Il logo dell'app non deve richiamare il verde Spotify, il cerchio o le onde. | S3 (sezione naming/logo) | [FONTE] | Il logo di Randomizer deve evitare il cerchio verde con le onde. |

### 2.2 Logo, attribuzione e artwork

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Ogni visualizzazione di metadati o copertine Spotify va accompagnata dal brand Spotify. Per le integrazioni è preferito il logo completo; la sola icona è ammessa se manca spazio. | S3; S2, sez. II | [FONTE] | Mostrare il logo Spotify nelle viste con elenchi di brani o playlist e nella vista di riproduzione. |
| Dimensioni minime: logo completo 70 px, icona 21 px. Area di rispetto pari a metà altezza dell'icona. Logo verde solo su sfondo bianco o nero, altrimenti versione monocromatica. Il logo non va ruotato, deformato o usato dentro una frase. | S3 | [FONTE] | Usare gli asset ufficiali e rispettare le misure minime anche su mobile. |
| Le copertine non vanno ritagliate e non vanno coperte con testo, immagini o loghi. Nessuna animazione o distorsione. Angoli arrotondati di 4 px (schermi piccoli e medi) o 8 px (schermi grandi). | S3 | [FONTE] | Niente griglie o collage ritagliati delle copertine e niente badge sopra la cover. Un collage generato per la playlist temporanea è a rischio (vedi §3). |
| Link di ritorno: per l'apertura in Spotify si usano i pulsanti "OPEN SPOTIFY", "PLAY ON SPOTIFY", "LISTEN ON SPOTIFY" oppure "GET SPOTIFY FREE". | S3 | [FONTE] | Aggiungere un pulsante "Apri Spotify" o "Play on Spotify" che porti alla playlist o al brano. |

### 2.3 Metadati e contenuti mostrati

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Metadati e copertine devono avere un link di ritorno all'album, al contenuto o alla playlist su Spotify. | S2, sez. II | [FONTE] | Ogni brano o playlist mostrata deve essere cliccabile verso `open.spotify.com/...` (oppure l'URI). |
| I metadati vanno mostrati come li fornisce Spotify e devono restare leggibili. Il troncamento è ammesso se l'utente può comunque vedere il testo completo. Lunghezze minime da prevedere: playlist/album 25 caratteri, artista 18, brano 23. | S3 | [FONTE] | Non rinominare né "pulire" i titoli, ad esempio togliendo "- Remastered". Usare ellissi con tooltip o espansione. |
| Metadati, copertine e anteprime non possono essere offerti come servizio a sé. | S2, sez. II e V | [FONTE] | Nessun impatto: il nostro scopo è la riproduzione. |
| In streaming, metadati e copertine si usano solo insieme al contenuto sottostante. Non riprodurre senza mostrare copertina e metadati pertinenti. | S2, sez. II | [FONTE] | Durante la riproduzione mostrare il brano corrente (copertina, titolo, artista) oppure delegare a Spotify. [INTERPRETAZIONE] Se la riproduzione avviene nel client Spotify (Connect), le info sono mostrate lì. Mostrarle anche nell'app è comunque più prudente. |
| Non gonfiare artificialmente ascolti o follower con bot o script. | S2, sez. II | [FONTE] | Consentito se la riproduzione parte solo da un'azione dell'utente. Vietati loop automatici o riproduzioni senza ascolto reale. |

### 2.4 Archiviazione, cache, conservazione e cancellazione

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Non archiviare né creare database o compilazioni di Contenuti Spotify oltre lo stretto necessario per far funzionare l'app. Usare dati il più possibile aggiornati ed eliminare quelli vecchi. | S1, sez. IV.3 (e V.4, numerazione da estrazione) | [FONTE] | Non tenere un indice persistente di brani, playlist o ISRC. Ricaricare i dati via API a ogni sessione. |
| La cache locale è ammessa solo per metadati e copertine e per i download condizionati offline (Premium). | S1, sez. IV.3.2 | [FONTE] | Cache in memoria di sessione dei metadati: OK. |
| Salvare in localStorage i preset (ID playlist e pesi). | Nessuna regola specifica | [INTERPRETAZIONE] | Probabilmente accettabile: sono preferenze dell'utente, conservate sul suo dispositivo e necessarie alla funzione. Salvare solo ID e pesi, non metadati o liste di tracce. Prevedere "cancella preset" e svuotarli al logout o disconnect. |
| I dati personali Spotify si trattano solo per il tempo necessario a fornire l'app. | S1, sez. V; S2, sez. I | [FONTE] | Non conservare token o dati utente oltre la sessione, salvo il refresh token se serve. |
| L'utente deve avere un modo facile per disconnettere l'account in qualsiasi momento. Dopo la disconnessione i suoi dati personali vanno cancellati e non vanno più trattati. | S1, sez. V.8–V.9; S2, sez. I.1.b | [FONTE] | Serve un pulsante "Disconnetti Spotify" visibile che cancelli token, preset e cache. |
| Dopo la disconnessione i dati personali vanno cancellati entro 5 giorni. | S1, Appendice sulla protezione dei dati, sez. 5(c) | [FONTE] | Con dati solo lato client la cancellazione è immediata. Con un backend serve un job di cancellazione entro 5 giorni. |
| Consiglio: un pulsante di cancellazione self-service facile da trovare, invece di richieste via email. Non salvare dati che si possono richiedere di nuovo via API. | S4 | [FONTE] (buona pratica, non obbligo contrattuale) | Il pulsante "Disconnetti" deve cancellare anche i dati. |
| Alla cessazione del contratto tutti i Contenuti Spotify vanno cancellati. | S1, sez. IX.8 | [FONTE] | Rilevante solo se l'app viene chiusa o sospesa. |

### 2.5 Privacy policy e consenso

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Serve una privacy policy che spieghi come si accede ai dati utente e come li si usa, tratta e condivide. | S2, sez. I.1.a | [FONTE] | Serve anche per un'app tra amici: la policy non prevede eccezioni per la Development Mode (vedi §3). |
| Mostrare agli utenti, prima dell'iscrizione o installazione, un accordo d'uso vincolante e una privacy policy. La policy deve indicare dati raccolti, condivisioni, un contatto e l'uso dei cookie con le opzioni di gestione. | S1, sez. V.11–V.12 | [FONTE] | Nella schermata di login: link a una pagina `/privacy` e a una pagina `/terms`, anche brevi, prima del pulsante "Accedi con Spotify". Citare il localStorage. |
| Richiedere solo i dati necessari. Serve consenso esplicito per usare dati oltre le categorie accettate. Niente email agli utenti senza consenso. | S1, sez. V; S2, sez. I; S4 | [FONTE] | Chiedere scope minimi (vedi 2.9). Non raccogliere l'email: `email` non viene più restituita da `/me` (S12). |
| Protezione dei dati con misure di sicurezza standard del settore. | S2, sez. I | [FONTE] | HTTPS, niente token negli URL, niente client secret nel frontend. |

### 2.6 Usi vietati (con verifica specifica sulle funzioni di Randomizer)

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Vietato fare segue, mix, remix o sovrapporre Contenuti Spotify con altro audio. | S2, sez. III.7; S4 ("DJ/mixing") | [FONTE] | [INTERPRETAZIONE] Il nostro "mix" è un ordinamento di brani interi riprodotti da Spotify, non un mixaggio audio. Non è vietato, purché non ci siano crossfade gestiti da noi, sovrapposizioni o audio esterno. Evitare di chiamare la funzione "DJ mix" nell'interfaccia. |
| Vietato sincronizzare l'audio con media visivi (video, slideshow, pubblicità). | S2, sez. III.6 | [FONTE] | Niente visual o slideshow sincronizzati alla musica. |
| Vietata l'integrazione con altri servizi di streaming e il trasferimento di dati verso altri servizi (eccezione: portabilità dei dati personali). | S2, sez. III.5 e III.9 | [FONTE] | Nessun import da o export verso YouTube Music, Apple Music e simili. |
| Vietato imitare, replicare o cercare di sostituire un'esperienza centrale di Spotify senza permesso. | S2, sez. III.11 | [FONTE] | **Punto da valutare (§3).** Lo shuffle esiste già in Spotify. Randomizer però mescola più playlist con pesi e dedup ISRC, cosa che Spotify non offre, e usa il client Spotify per riprodurre. [INTERPRETAZIONE] Rischio basso, ma è la clausola più vicina alla funzione principale. |
| Vietato analizzare Contenuti Spotify o il servizio per qualsiasi scopo, incluse nuove metriche di ascolto derivate, benchmark e profilazione. | S2, sez. III.13 | [FONTE] | Consentito: dedup per ISRC e campionamento pesato sono logica funzionale, non analisi. [INTERPRETAZIONE] Evitare statistiche o dashboard ("i tuoi artisti più presenti", ecc.) e profili di gusto. |
| Vietato addestrare modelli di ML o AI con la piattaforma o i contenuti Spotify, o inserirvi contenuti. | S1, sez. IV.2.1 (a/1); S2, sez. III.14 | [FONTE] | Non passare tracklist a un LLM per "generare mix intelligenti". |
| Vietati giochi e quiz, suonerie e sveglie, controllo vocale, webcasting non interattivo, prodotti per bambini, uso business (negozi, locali, radio), generazione di news o offerte commerciali. | S2, sez. III.1–4, III.8, III.10, III.12 | [FONTE] | Non applicabile. Niente "modalità festa per il bar" o timer sveglia. |
| Vietato usare robot o spider per indicizzare contenuti e raccogliere dati utente. Vietato aggirare restrizioni geografiche. Vietato lo stream ripping. | S1, sez. IV | [FONTE] | Non applicabile, purché si legga solo la libreria dell'utente autenticato. |
| **Creare o riempire playlist in modo programmatico** | Nessuna clausola trovata | [FONTE per l'assenza] | Nessun divieto trovato in S1, S2, S3 o S4. Le API di creazione e modifica (`POST /me/playlists`, `POST /playlists/{id}/items`) sono documentate e disponibili anche per i Client ID nuovi (S11, S12, S18). S4 cita anche i "playlist manager" tra le app non-streaming monetizzabili. |
| **Shuffle o manipolazione della coda** | Nessuna clausola trovata | [FONTE per l'assenza] | Gli endpoint Player per controllo di riproduzione e coda sono documentati (S18) e richiedono Premium. Nessuna regola vieta lo shuffle in sé, salvo la III.11 citata sopra. |

### 2.7 Uso commerciale

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| La licenza di base copre app streaming e non-streaming per uso personale privato. | S1, sez. III.1.1 | [FONTE] | Il nostro caso rientra nella licenza base. |
| "Streaming" comprende anche il controllo di un'app Spotify in background. | S1, sez. II (Definizioni) | [FONTE] | [INTERPRETAZIONE] Avviando la riproduzione via Player API, Randomizer è una Streaming SDA. |
| Le app streaming non possono essere vendute, non possono avere pagamenti in-app e non possono mostrare pubblicità. Monetizzazione solo per le app non-streaming. | S2, sez. IV; S4 | [FONTE] | Nessun annuncio, pagamento o "donazione per sbloccare". Se in futuro servisse monetizzare, andrebbe tolta la riproduzione. |
| La musica in streaming è disponibile solo agli utenti Premium. | S2, sez. IV; S18 (Start Playback) | [FONTE] | Anche gli amici devono avere Premium per l'avvio della riproduzione, altrimenti ricevono 403. Se non ce l'hanno, creano la playlist e la aprono a mano. |

### 2.8 Limiti della Development Mode

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Il proprietario dell'app deve avere Premium attivo. Se Premium scade, l'app smette di funzionare. Vale anche per le app esistenti dal 9 marzo 2026. | S5; S11; S15 | [FONTE] | Tenere attivo Premium sull'account che possiede il Client ID. |
| Massimo 5 utenti autorizzati per Client ID, da inserire in allowlist nella Dashboard. Vale anche per le app esistenti. Chi aveva già più di 5 utenti li mantiene. | S5; S11; S15 | [FONTE] | Proprietario più 4 amici rientra nel limite. Ogni amico va aggiunto in Dashboard (nome ed email dell'account Spotify). |
| Client ID per sviluppatore: 1 da febbraio 2026, portati a **25** dal 23 luglio 2026. | S15; S17; S11 | [FONTE] | Nessun vincolo pratico. |
| La quota è condivisa tra tutti i Client ID in Development Mode dello stesso account sviluppatore (dal 23 luglio 2026). | S17; S5 | [FONTE] | Altri progetti sullo stesso account consumano la stessa quota. |
| Per i **Client ID nuovi** (dall'11 febbraio 2026) gli endpoint sono ridotti. `GET /playlists/{id}/items` funziona solo per playlist possedute o collaborative; per le altre arrivano solo metadati (403 sull'endpoint items). | S11; S12; S18 (Get Playlist Items) | [FONTE] | **Critico:** con un Client ID nuovo non si possono leggere i brani delle playlist *seguite* ma non possedute. |
| Per i **Client ID esistenti** le restrizioni sugli endpoint sono **rinviate** (aggiornamento del 9 marzo 2026). Premium, tetto di utenti e limite di Client ID restano in vigore. Nessuna nuova data annunciata. | S15 (nota del 9 marzo) | [FONTE] | Il Client ID del 2022 dovrebbe ancora poter leggere le playlist seguite. È una tolleranza revocabile senza data (§3). **Non ricreare il Client ID.** Nota: la guida S11 non parla del rinvio e presenta il 9 marzo come data di migrazione. Le due fonti non coincidono. |
| Endpoint rinominati: `/playlists/{id}/tracks` diventa `/playlists/{id}/items`. Il campo `tracks` diventa `items` e `items[].track` diventa `items[].item`. `POST /users/{id}/playlists` diventa `POST /me/playlists`. L'unfollow di una playlist passa da `DELETE /playlists/{id}/followers` a `DELETE /me/library?uris=spotify:playlist:{id}`. | S11; S12 | [FONTE] | Usare già i nuovi endpoint anche con il Client ID vecchio. Sono il percorso "a prova di futuro". |
| `external_ids` (ISRC) su Track e Album: indicato come rimosso a febbraio, poi **ripristinato** a marzo 2026. | S12; S13 | [FONTE] | La dedup per ISRC è fattibile. Prevedere un fallback (es. ID traccia oppure nome e artista normalizzati) se `external_ids.isrc` manca. |
| `GET /me/tracks` (Brani che ti piacciono) non risulta tra gli endpoint rimossi e restituisce `external_ids`. | S11; S12; S18 | [FONTE] | Lettura dei Brani che ti piacciono: OK. |
| Rimossi i fetch in blocco (`GET /tracks?ids=`, ecc.). `GET /users/{id}/playlists` sostituito da `GET /me/playlists`. Search limitata a massimo 10 risultati. Da `/me` spariscono `country`, `email`, `product`. Aggiunto `account_id` (maggio 2026). | S12; S14 | [FONTE] | Non si può leggere `product` per verificare Premium: gestire il 403 sul player. Usare `account_id` come chiave utente stabile. |
| Spotify può sospendere l'accesso o i permessi non usati per 90 giorni. | S1, sez. IX.8.5 | [FONTE] | [INTERPRETAZIONE] Se il Client ID del 2022 resta inattivo a lungo rischia la sospensione e con essa la perdita dello stato "esistente". Usarlo con regolarità. |

### 2.9 Autenticazione

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Per app senza possibilità di custodire un segreto (SPA): Authorization Code con PKCE. `code_verifier` casuale di 43–128 caratteri, `code_challenge_method=S256`, nessun client secret. | S7 | [FONTE] | Usare PKCE nel frontend. Includere `state` contro CSRF. |
| Redirect URI in HTTPS; HTTP solo per indirizzi loopback espliciti (`http://127.0.0.1:PORT`, `http://[::1]:PORT`). **`localhost` non è ammesso.** Regole in vigore per le app nuove dal 9 aprile 2025 e per tutte da novembre 2025. | S6 | [FONTE] | In sviluppo usare `http://127.0.0.1:5173/callback` (non `localhost`). In produzione HTTPS. Registrare in Dashboard l'URI esatto. |
| La porta del loopback può essere omessa in registrazione e indicata nella richiesta (solo per IP loopback). | S6 | [FONTE] | Utile se la porta del dev server cambia. |
| L'access token dura 1 ora (`expires_in` 3600). | S8 | [FONTE] | Rinnovo automatico prima della scadenza. |
| Refresh con PKCE: `grant_type=refresh_token`, `refresh_token`, `client_id`. La risposta può contenere o no un nuovo refresh token; se manca si continua con il precedente. | S7; S8 | [FONTE] | Salvare sempre l'eventuale nuovo refresh token. |
| Il refresh token scade **6 mesi (circa 180 giorni) dopo l'autorizzazione originale**, senza rinnovo a scorrimento. In vigore dal 18 giugno 2026 per le app nuove e dal 20 luglio 2026 per quelle esistenti. Alla scadenza si riceve `400 invalid_grant`: non riprovare, rifare il login. | S16; S8 | [FONTE] | Gestire `invalid_grant` con un redirect al login. Opzionale: salvare la data di autorizzazione. |

### 2.10 Scope necessari per Randomizer

Scope ricavati da S9 e dalle pagine di riferimento degli endpoint (S18).

| Scope | Serve per | Tipo |
|---|---|---|
| `playlist-read-private` | `GET /me/playlists` (incluse private), `GET /playlists/{id}/items` | [FONTE] |
| `playlist-read-collaborative` | includere le playlist collaborative nell'elenco | [FONTE] |
| `user-library-read` | `GET /me/tracks` (Brani che ti piacciono) | [FONTE] |
| `playlist-modify-private` | `POST /me/playlists` con `public:false`, `POST/PUT /playlists/{id}/items` sulla playlist temporanea | [FONTE] |
| `playlist-modify-public` | richiesto da `POST /me/playlists` (la pagina elenca entrambi gli scope modify) e accettato da `DELETE /me/library` | [FONTE], ma vedi nota |
| `user-library-modify` | `DELETE /me/library?uris=spotify:playlist:{id}` (unfollow o rimozione della playlist temporanea) | [FONTE]: la pagina accetta *uno tra* `user-library-modify`, `user-follow-modify`, `playlist-modify-public` |
| `user-modify-playback-state` | `PUT /me/player/play` con `context_uri` della playlist | [FONTE] |
| `user-read-playback-state` | `GET /me/player/devices` per scegliere il dispositivo | [FONTE] ([INTERPRETAZIONE] necessario se non c'è un dispositivo attivo) |
| `streaming` | solo se si usa il Web Playback SDK nel browser | [FONTE], opzionale |

Note:
- `POST /me/playlists` ha `public` a **true** di default: passare sempre `"public": false` [FONTE, S18].
- Non serve `user-read-private` né `user-read-email` (email e product non vengono più restituiti) [FONTE, S12].
- [INTERPRETAZIONE] Set minimo consigliato: `playlist-read-private playlist-read-collaborative user-library-read playlist-modify-private playlist-modify-public user-library-modify user-modify-playback-state user-read-playback-state`. Con `user-library-modify` si potrebbe forse fare a meno di `playlist-modify-public` per l'unfollow, ma la pagina di Create Playlist lo elenca comunque. Va verificato con una prova reale.

### 2.11 Rate limit e quota

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Il rate limit si calcola su una finestra mobile di 30 secondi. Oltre il limite si riceve 429, di solito con l'header `Retry-After` (secondi). | S10 | [FONTE] | Backoff che rispetta `Retry-After`. Caricamento pigro delle playlist (solo quelle selezionate). |
| In Development Mode c'è anche una **quota** per gruppi di endpoint, condivisa a livello di account sviluppatore. Se viene superata si riceve 429 con `"reason": "QUOTA_EXCEEDED"` nel JSON. Soglie e durata della finestra non sono pubblicate. | S5; S17 | [FONTE] | Distinguere `QUOTA_EXCEEDED` (inutile riprovare subito: mostrare un messaggio all'utente) dal rate limit normale (riprovare dopo `Retry-After`). |
| Buone pratiche: salvare lo `snapshot_id` delle playlist per evitare ricaricamenti, lazy loading, logging. Alcuni endpoint, come l'upload dell'immagine playlist, hanno limiti propri. | S10 | [FONTE] | Cache di sessione basata su `snapshot_id`. Evitare l'upload di cover personalizzate (limite dedicato e vincoli sull'artwork). |
| [INTERPRETAZIONE] Stima dei costi: `GET /playlists/{id}/items` restituisce al massimo 50 elementi per chiamata e `GET /me/tracks` 50. `POST .../items` accetta al massimo 100 URI per chiamata [conoscenza API, non ricontrollato oggi]. | S18 | Misto | Una libreria di 5.000 brani piaciuti costa circa 100 chiamate: limitare o campionare prima di scaricare tutto. |

### 2.12 Criteri per l'Extended Quota

| Regola (parafrasi) | Riferimento | Tipo | Impatto su Randomizer |
|---|---|---|---|
| Dal 15 maggio 2025 l'Extended Quota è riservata alle organizzazioni: società registrata, servizio già lanciato, almeno **250.000 MAU**, presenza nei mercati chiave, sostenibilità commerciale. Domanda da email aziendale; revisione fino a 6 settimane. | S5 | [FONTE] | **Irraggiungibile** per Randomizer: si resta in Development Mode per sempre, quindi massimo 5 utenti. |
| La quota estesa vale solo per il caso d'uso esaminato; eventuali cambi vanno notificati. | S2, sez. VII; S1, sez. VI | [FONTE] | Non applicabile. |

---

## 3. Rischi e punti aperti

1. **Funzione principale (playlist temporanea generata automaticamente e shuffle tra playlist).**
   - [FONTE] Nessuna clausola di Terms, Policy, Branding o Compliance Tips vieta di creare, riempire o cancellare playlist in modo programmatico nell'account dell'utente, né di controllare la riproduzione o la coda. Le API relative sono ufficiali e sono state mantenute nella migrazione del 2026.
   - [INTERPRETAZIONE] Le clausole più vicine sono tre. **III.11**: non replicare o sostituire un'esperienza centrale di Spotify. Lo shuffle è una funzione di Spotify, ma il mix pesato tra più playlist con dedup è un valore aggiunto e la riproduzione resta nel client Spotify: rischio basso. **III.7** (segue/mix): riguarda l'audio, non l'ordine dei brani, quindi non si applica se non manipoliamo l'audio. **III.13** (analisi dei contenuti): la dedup ISRC è funzionale, non un'analisi, ma conviene non aggiungere statistiche.
   - [INTERPRETAZIONE] Buone pratiche di mitigazione: creare la playlist solo su azione esplicita dell'utente; renderla privata (`public:false`) con un nome e una descrizione chiari (es. "Randomizer – temporanea"); rimuoverla davvero a fine sessione, con un pulsante di pulizia per le playlist rimaste orfane; non creare playlist in batch o in background.
   - Nota tecnica [INTERPRETAZIONE]: su Spotify "cancellare" una playlist significa smettere di seguirla. La playlist resta come oggetto e può ricomparire se qualcuno ha il link. Non è un problema di policy, ma va detto nella privacy policy o nella UI.

2. **Serve una privacy policy per un'app tra amici in Development Mode?**
   - [FONTE] S1 (V.11–V.12) e S2 (I.1.a) chiedono una privacy policy e un accordo d'uso mostrati prima della registrazione, **senza eccezioni** per la Development Mode o per l'uso personale. Non ho trovato una pagina che esenti le app in dev mode.
   - [INTERPRETAZIONE] In pratica Spotify non verifica le app in dev mode, ma il contratto vale comunque. Costa poco adeguarsi: una pagina `/privacy` breve (dati letti, nessun server o solo token, localStorage, come disconnettersi e cancellare, contatto) e una riga di termini d'uso, con link nella schermata di login. Con un backend la policy diventa ancora più necessaria (conservazione dei token, cancellazione entro 5 giorni).

3. **Client ID del 2022 e restrizioni degli endpoint rinviate.**
   - [FONTE] Le restrizioni sugli endpoint per i Client ID esistenti sono rinviate "fino a nuovo avviso" (S15, 9 marzo 2026). S11 non riporta il rinvio. Le due fonti non coincidono.
   - Rischio: se Spotify applica le restrizioni, non si potranno più leggere i brani delle playlist **seguite ma non possedute**. Solo possedute, collaborative e Brani che ti piacciono resterebbero disponibili. Questo vale già oggi per un Client ID nuovo.
   - Da fare: progettare l'interfaccia in modo che le playlist non leggibili (403 su `/items`) vengano segnate come "non disponibili" invece di rompere il flusso. Non cancellare né ricreare il Client ID. Usarlo con regolarità (sospensione dopo 90 giorni di inattività, S1 IX.8.5). Tenere d'occhio il blog e i changelog.
   - Da verificare con una prova reale: che il Client ID del 2022 possa ancora leggere `/playlists/{id}/items` di una playlist seguita.

4. **Amici senza Premium.** La riproduzione via API richiede Premium (S18). Un amico Free potrebbe al massimo generare la playlist e aprirla da solo. [INTERPRETAZIONE] Anche la creazione della playlist dovrebbe funzionare per un Free, ma non è verificato. Non si può leggere `product` da `/me`, quindi bisogna gestire il 403.

5. **Artwork della playlist temporanea.** Spotify genera da solo un mosaico delle copertine. Caricare una cover personalizzata con un collage o un logo sopra le copertine violerebbe le regole sull'artwork (S3). Meglio nessuna cover personalizzata.

6. **Preset in localStorage.** Nessuna regola specifica. [INTERPRETAZIONE] Sono compatibili se contengono solo ID e pesi e vengono cancellati con "Disconnetti". Se si sincronizzano su un backend diventano dati personali da dichiarare e cancellare entro 5 giorni.

7. **Scope per l'unfollow.** `DELETE /me/library` accetta `user-library-modify`, `user-follow-modify` oppure `playlist-modify-public`. Non è chiaro se basti per una playlist **privata**. Da verificare con una prova reale.

8. **Numeri di sezione.** Sono ricavati da un'estrazione automatica del testo. Due letture hanno numerato la clausola ML in modo diverso (IV.2.1.a e IV.2.1.1). Ricontrollare a mano prima di citarli formalmente. Design Guidelines, Compliance Tips e le pagine tecniche non mostrano una data di aggiornamento.
