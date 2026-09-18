# Randomizer

Web app che mescola brani da più playlist Spotify in un'unica playlist temporanea. Progetto personale e da portfolio: gratuito in ogni sua parte (nessun servizio a pagamento), usato dal proprietario e da al massimo 4 amici.

## Struttura

Un solo repo, pubblico: `teodea/randomizer` (anche portfolio). Codice e documenti di metodo convivono:

- `docs/spotify-policies.md` — policy Spotify verificate (18/09/2026)
- `docs/agents/` — setup delle skill di Pocock
- `CONTEXT.md`, `docs/adr/` — glossario e ADR, creati da Pocock quando servono
- `DEVLOG.md` — diario di sessione

Il repo è pubblico: nessun segreto nel repo. Il login usa PKCE, che richiede solo il Client ID (pubblico per natura); il Client Secret della dashboard non serve e non entra mai nel codice.

## Lingue

- **App: solo inglese** — UI, testi, privacy policy, termini, README, commit e issue.
- **Documenti di lavoro: italiano** — DEVLOG, ADR, note in `docs/`.

## Spotify

Prima di scegliere nomi, loghi, scope, endpoint o cosa salvare, leggi `docs/spotify-policies.md`. I vincoli che cambiano il design:

- Si usa l'app della dashboard **Randomizer** (Client ID creato nel 2022). Tienila: essendo precedente al febbraio 2026 legge ancora le playlist *seguite*; un Client ID nuovo leggerebbe solo quelle possedute o collaborative. L'accesso può essere revocato in futuro, quindi l'app deve degradare con grazia (playlist "non disponibile") invece di rompersi.
- Development mode: max 5 utenti in allowlist, owner con Premium, login con PKCE, redirect URI su `127.0.0.1` in locale (mai `localhost`).
- Il nome dell'app e il dominio non contengono "Spotify" né suoi derivati.

## Skill

Arrivano da due plugin a livello utente, già attivi: `mattpocock-skills` e `impeccable`. Sono le sole skill del progetto. Le skill **user-invoked** di Pocock (`to-spec`, `to-tickets`, `triage`, `implement`, `handoff`, …) non compaiono nell'elenco della sessione ma funzionano quando l'utente digita `/nome`.

## Fine sessione

Aggiungi una voce datata a `DEVLOG.md`: cosa si è deciso o fatto e perché.

## Agent skills

### Issue tracker

GitHub Issues su `teodea/randomizer`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` alla radice. See `docs/agents/domain.md`.
