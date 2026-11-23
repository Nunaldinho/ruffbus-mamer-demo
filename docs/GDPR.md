# Data protection note

How the Ruffbus Mamer booking prototype handles personal data, written for the commune and its data protection officer (DPO). It describes what the software does today. Points marked **To decide** need the commune's decision; nothing here is legal advice.

## Who is responsible

| Role | Who (proposal) |
|---|---|
| Controller | Commune de Mamer, which offers the service |
| Processors | The operator running the call centre and the minibuses; the hosting provider; the SMS provider. Each needs a data-processing agreement (GDPR art. 28) |

**To decide**: legal basis. The service is a public service of the commune, which points to a task in the public interest (art. 6(1)(e)); the DPO should confirm.

## What is stored, why, and for how long

| Data | Purpose | Who sees it | Kept |
|---|---|---|---|
| Name, mobile number, pick-up and drop-off address | Run the ride, inform the passenger | Call centre, administrator | Anonymised 90 days after the booking's last ride |
| Needs: wheelchair, pushchair, child seat, shopping trolley | Send a suitable minibus | Call centre, administrator | Deleted with the name and address |
| Village or destination commune, time, number of adults and children, channel | Usage statistics | Everyone with access, including the commune's read-only role | Kept; no longer personal once anonymised |
| Verified mobile number (the resident's "account") | Sign-in, list of own rides | The resident | Deleted on request, or after 90 days without use and without bookings |
| Login codes | Confirm the number | Nobody: only a keyed hash is stored | 1 day |
| Text messages sent | Record of what was sent | Call centre, administrator | 7 days; login codes stored masked |
| Audit log: who confirmed, moved or cancelled what | Security and accountability | Administrator | 365 days; residents appear as a number, never by name |
| Network address of whoever requests a code | Rate limiting against abuse | Nobody: only a keyed hash is stored | 1 day, with the code |

The periods are settings (`RETENTION_DAYS`, `SMS_RETENTION_DAYS`, `AUDIT_RETENTION_DAYS`). A job anonymises and deletes data every night at 3:00; the administrator can also run it from the staff screen, which shows what is held and what is due.

**Not collected**: e-mail address, password, date of birth, identity document, payment data, location tracking. Residence in the commune is self-declared by a tick box. Children are counted, not named.

**To decide**: the "wheelchair" need can reveal health information (art. 9). It is optional, explained on the form, visible only to the call centre and deleted with the booking. The DPO should confirm the condition relied on (for example explicit consent given by ticking it) or decide to word it as a vehicle requirement only.

## People's rights

- **Access and portability** (art. 15, 20): "Download my data" gives a JSON file with the account, bookings and rides linked to the number, and the resident's own actions.
- **Erasure** (art. 17): "Delete my data" cancels future rides, anonymises past bookings (including phone bookings made with the same number), and deletes the account, sessions, codes and messages. Anonymous counts remain.
- **Rectification** (art. 16): cancel and book again, or call the call centre.
- Each action is recorded in the audit log without personal details. The privacy page tells residents they can complain to the CNPD.

## Security

Summary; details in [ARCHITECTURE.md](ARCHITECTURE.md).

- Roles enforced on the server: the commune's read-only role never receives names, numbers or addresses.
- No passwords for residents; one-time codes with expiry, attempt limits and rate limits. Staff passwords hashed with scrypt, accounts locked after repeated failures.
- Session tokens, codes and network addresses stored only as hashes.
- Strict Content-Security-Policy; no third-party scripts, fonts, analytics or trackers, so visiting the site sends nothing to other companies.
- One strictly necessary cookie (staying signed in). The chosen language is kept in the browser only. No cookie banner is needed for this; the DPO should confirm.
- The database refuses double bookings by itself, so data integrity does not depend on the web page.

## To put in place for a pilot

1. Host in the EU (a commune server or an EU provider) with encrypted disks and backups. Keep backups no longer than 30 days so deleted data also leaves the backups.
2. Use HTTPS only (`COOKIE_SECURE=true`), a random `SECRET_KEY`, and `DEMO_MODE=false`.
3. Keep web server access logs, which contain network addresses, for 14 days at most.
4. Sign data-processing agreements with the operator, host and SMS provider.
5. Add the processing to the commune's record of processing activities (art. 30); the table above is a starting point.
6. Ask the DPO whether a data protection impact assessment is needed. The processing is small, but includes optional data that may concern health.
7. Name the controller and its DPO contact on the privacy page.
