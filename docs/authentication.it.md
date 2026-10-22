# Accesso, ruoli e sicurezza

Ogni istanza di ChihuahuaBook ha **una sola biblioteca condivisa**. Chi accede vede gli stessi libri, collezioni e prestiti; cosa può fare dipende dal ruolo.

| Ruolo | Può |
| --- | --- |
| **Lettore** | Consultare tutto il catalogo, in sola lettura. Nessun accesso alle impostazioni. |
| **Bibliotecario** | Tutto ciò che fa il lettore, più aggiungere, modificare ed eliminare libri, collezioni, prestiti e copertine, e importare file `.pedia`. |
| **Amministratore** | Tutto ciò che fa il bibliotecario, più gestire gli utenti (ruoli, inviti, disattivazione) e le impostazioni dell'istanza, compresa la lingua dell'interfaccia. |

I ruoli sono applicati in tre punti, così un errore in uno strato non apre i dati:

1. **Database (RLS)**: `supabase/migrations/20261022160000_roles.sql`. La funzione `public.has_role()` legge il ruolo da `public.members` e ogni policy la usa. È la garanzia vera: vale anche per chi chiama Supabase direttamente con il proprio token.
2. **API**: ogni rotta in `src/server/http` dichiara il ruolo minimo (`guarded("read" | "edit" | "administer")`) e risponde `401` senza sessione, `403` con un ruolo insufficiente.
3. **Interfaccia**: il lettore non vede i comandi di modifica; il lettore non apre le Impostazioni; solo l'amministratore vi vede la sezione **Utenti e ruoli**.

## Impostazioni e lingua

Il lettore non apre le Impostazioni. Il bibliotecario vede le sue preferenze personali (palette colori, dimensione delle copertine) e la sezione Informazioni. L'amministratore vede anche **Lingua** e **Utenti e ruoli**.

L'interfaccia è disponibile in italiano e in inglese. La lingua è una per tutta l'istanza (`instance_settings.language`, italiano se non scelta): la cambia solo l'amministratore, e la usa anche la pagina di accesso. I testi sono in `src/features/i18n/messages/` (`it.ts` è il riferimento, `en.ts` deve avere le stesse chiavi e TypeScript lo verifica).

## Il primo amministratore

Su un'istanza nuova **il primo account che si registra diventa amministratore**. La pagina di accesso lo dice ("questa istanza è nuova").

Da lì in poi la registrazione è **su invito**: in Impostazioni → *Utenti e ruoli* l'amministratore inserisce un'email, e solo quell'email può creare l'account (l'invito vale 14 giorni). L'amministratore può anche aprire la registrazione a tutti.

## Utenti e ruoli

**Chi entra è sempre Lettore**, sia con un invito sia con la registrazione aperta: l'invito non sceglie il ruolo. Bibliotecario e Amministratore si diventano solo per promozione, dalla sezione *Utenti e ruoli* delle Impostazioni (visibile solo all'amministratore):

- in cima, i tre ruoli con cosa può fare ciascuno e quanti membri attivi ne hanno;
- per ogni membro, un selettore Lettore / Bibliotecario / Amministratore: il cambio vale subito, e la promozione ad amministratore chiede una conferma;
- il pulsante accanto al nome disattiva o riattiva l'account;
- con più di quattro membri compare una ricerca per nome o email.

Tutto avviene in un trigger su `auth.users` (`public.handle_new_user`), quindi all'app non serve la chiave `service_role`. Una registrazione senza invito viene rifiutata dal database e la pagina spiega perché.

> Crea l'amministratore subito dopo il deploy, prima di condividere l'indirizzo.

Altre regole:

- Un'istanza ha sempre almeno un amministratore attivo: il database rifiuta di declassare o disattivare l'ultimo.
- L'amministratore non può declassare o disattivare sé stesso dall'interfaccia (chiedi a un altro amministratore).
- Un utente disattivato può ancora accedere ma non vede nulla: la RLS non gli restituisce righe.
- Per eliminare definitivamente un account usa la dashboard di Supabase (Authentication → Users).

### Se resti chiuso fuori

Dall'editor SQL di Supabase:

```sql
update public.members set role = 'admin', active = true
where email = 'tu@example.com';
```

## Configurare Supabase Auth

Nella dashboard del progetto Supabase (Authentication):

1. **URL Configuration**: *Site URL* = l'indirizzo dell'app (es. `https://libri.example.com`). Aggiungi `https://libri.example.com/auth/confirm` alle *Redirect URLs*.
2. **Sign In / Providers → Email**: lascia attivo *Confirm email*. La registrazione deve restare abilitata: gli inviti passano dalla registrazione normale, ed è il database a respingere chi non è invitato.
3. **Password**: lunghezza minima 10, con lettere e numeri (le stesse regole sono in `supabase/config.toml` per lo stack locale). Attiva la *leaked password protection* se il tuo piano la prevede.
4. **Rate limits**: i valori predefiniti vanno bene; `config.toml` abbassa accessi e registrazioni a 15 ogni 5 minuti per IP. Il login va dal browser direttamente a Supabase Auth, quindi sono questi limiti a proteggere dai tentativi di indovinare le password.
5. Facoltativo: **Attack Protection → CAPTCHA** (Turnstile o hCaptcha) se l'istanza è pubblica.
6. Senza un server SMTP tuo Supabase manda pochissime email all'ora: configurane uno (Authentication → Emails → SMTP) prima di invitare persone.

I link delle email arrivano su `/auth/confirm`, che funziona sia con i template predefiniti (PKCE `?code=`) sia con i template che usano `{{ .TokenHash }}`.

## Altre misure di sicurezza

- **Pagine protette**: il proxy (`src/proxy.ts`) aggiorna la sessione e manda chi non ce l'ha su `/login`; le pagine ricontrollano il ruolo sul server. In produzione, senza configurazione Supabase, le pagine rispondono `503` invece di aprirsi.
- **CSRF**: le chiamate API che modificano dati con il cookie di sessione devono arrivare dalla stessa origine (`Origin` o `Sec-Fetch-Site`), altrimenti `403 cross_origin`. Anche l'uscita è un `POST` con lo stesso controllo.
- **Header di sicurezza** su ogni risposta (`src/config/security-headers.ts`): Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy.
- **Redirect sicuri**: dopo il login l'app torna solo a percorsi interni (`?next=/…`), mai a indirizzi esterni.
- **Errori generici**: le pagine di accesso e di recupero password non rivelano se un'email è registrata.

## Sviluppo in locale

Senza Supabase, `npm run dev` apre comunque l'interfaccia sui dati di esempio con un utente dimostrativo amministratore. Per vederla con un altro ruolo:

```bash
DEMO_ROLE=reader DEMO_LANGUAGE=en npm run dev
```

L'utente dimostrativo esiste solo in `npm run dev`; una build di produzione senza configurazione rifiuta tutte le pagine.

Con lo stack Supabase locale (`npx supabase start`) le email di conferma finiscono in Mailpit su <http://127.0.0.1:54324>.

I test della RLS sono in `supabase/tests/roles.test.sql`: girano su un database con le migrazioni applicate, dentro una transazione che viene annullata.

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/roles.test.sql
```

Lanciali su un database vuoto: il primo controllo si aspetta che non ci siano utenti.
