/* Texts. T: booking page (FR, DE, EN, PT). TS: staff screen (FR, EN); falls back to T for shared texts. */
"use strict";
const T = {
en: {
  demoTag: "Prototype.", banner: "Built by a Holzem resident to show how online booking could work. Not an official service of the Commune de Mamer: bookings go into a test database and no bus will come.",
  bannerDemo: "Don’t enter real personal details: anyone can open the staff screen with the demo accounts.", bannerReset: "Everything entered here is deleted every day.",
  tagline: "The commune of Mamer’s on-demand minibus", tabBook: "Book a ride", tabMine: "My rides", tabPrivacy: "Your data", tabAbout: "About this prototype",
  heroTitle: "Door to door in Mamer, Capellen and Holzem", heroSub: "Free electric minibus, every day from 9:00 to 18:00 except public holidays. Request a ride here instead of calling 2810 831.",
  stopPickup: "Pick-up", stopDropoff: "Drop-off", stopWhen: "When", stopWho: "Who’s travelling", stopContact: "Your details",
  inCommune: "In the commune", listedDest: "Outside the commune", locality: "Village", street: "Street and number", streetPh: "e.g. 7A route de Capellen",
  destination: "Destination", chooseDest: "Choose a destination", outsideHint: "Outside the commune, the Ruffbus only serves the places on this list, and only for residents.",
  date: "Day", hoursHint: (l, d) => `Book at least ${l} minutes and up to ${d} days ahead. No service on public holidays.`,
  time: "Pick-up time", chooseTime: "Choose a time", loadingTimes: "Checking free buses…", tomorrow: "Tomorrow", todayShort: "Today", holiday: "Holiday",
  slotFree: n => n === 1 ? "1 bus free" : n + " buses free", slotFull: "full", slotDays: (a, b) => `free on ${a} of ${b} days`,
  fullHint: "Times marked full have no minibus free. Choose another time or call 2810 831.",
  returnTrip: "Add a return trip", returnTime: "Return pick-up time", repeat: "Repeat every week", repeatDays: "On these days", repeatWeeks: "For how long",
  weeksN: n => n + (n > 1 ? " weeks" : " week"), repeatHint: "Handy for regular trips, like a crèche pick-up. Public holidays are skipped.",
  adults: "Adults", children: "Children under 13", childrenNote: "Children under 13 travel with an adult. Children up to 12 ride free.",
  needs: "Anything the driver should know?", needsNote: "Only used to send a suitable minibus, and deleted with the booking.",
  need_seat: "Child car seat", need_stroller: "Pushchair", need_wheel: "Wheelchair", need_bags: "Shopping trolley",
  name: "Name", phone: "Mobile number", phoneHint: "We text you a 6-digit code to confirm this number. With it you can also see and cancel your rides.",
  sms: "Text me when my ride is confirmed", resident: "I live in the commune of Mamer", residentNote: "Trips outside the commune are for residents only.",
  signedInAs: "Signed in as", signOut: "Sign out", sendCode: "Text me a code", codeLabel: "Code from the text message",
  codeSent: p => `We sent a code to ${p}. It is valid for 10 minutes.`, demoCode: "Prototype: no text message is sent. Your code is",
  verifyBook: "Confirm and request ride", verify: "Confirm", resend: "Send a new code", changeNumber: "Change number",
  submit: "Request ride", sending: "Sending…",
  yourRide: "Your ride", fillIn: "Fill in the stops and your ride appears here.", pickupAt: "Pick-up", returnAt: "Return", estRide: "Estimated ride",
  minN: n => "≈ " + n + " min", pax: (a, c) => a + (a === 1 ? " adult" : " adults") + (c ? ", " + c + (c === 1 ? " child" : " children") : ""),
  rides: n => n + (n === 1 ? " ride" : " rides"), free: "Free", price: "Price", colNeeds: "Needs",
  wontFit: n => n + (n === 1 ? " ride won’t fit" : " rides won’t fit") + " (no minibus free)",
  errPick: "Choose where to pick you up.", errDrop: "Choose where you’re going.", errStreet: "Enter the street and number.", errDest: "Choose a destination from the list.",
  errOutside: "One end of the trip must be in Mamer, Capellen or Holzem.", errSame: "Pick-up and drop-off are the same place.",
  errDay: "Choose a day.", errWindow: "Choose a day in the next 7 days.", errHoliday: "No service on public holidays.", errTime: "Choose a pick-up time.",
  errLead: "Book at least 30 minutes ahead.", errRet: "Choose a return time at least 30 minutes after the pick-up.", errDays: "Choose at least one day.",
  errSeats: "The minibus has 8 seats.", errAdult: "Children under 13 need an adult with them.", errRes: "Confirm you live in the commune to travel outside it.",
  errName: "Enter your name.", errPhone: "Enter a mobile number that can receive texts.", errCode: "That code is not right. Check the text message and try again.",
  errCodeExpired: "That code has expired or was tried too often. Ask for a new one.", errTooMany: "Too many codes requested. Wait 15 minutes and try again.",
  errFull: "No minibus is free at that time. Choose another time.", errFix: "Check the steps marked in red.", tooLate: "This ride has already started.",
  badTransition: "This ride can no longer be changed.", notFound: "Not found.", network: "No connection. Check your internet and try again.",
  server: "Something went wrong on our side. Try again in a minute.", unavailable: "The service is busy. Try again in a minute.",
  login: "Please sign in again.", invalid: "Check the form and try again.", csrf: "Reload the page and try again.",
  partialAsk: (n, t) => `${n} of ${t} rides can’t be booked: no minibus is free then.`, bookRest: "Book the others", changeTimes: "Change times",
  doneTitle: "Ride requested", doneSub: "Your request is in the call centre’s queue. You get a text message when each ride is confirmed.",
  doneDemo: "Prototype: text messages are simulated. Open the staff screen to see your request arrive.",
  ref: "Reference", skipped: "public holiday, skipped", notBooked: "Not booked, no minibus free", bookAnother: "Book another ride", seeMine: "See my rides",
  mineTitle: "My rides", mineEmpty: "No rides yet. Book one and it appears here.", mineLogin: "Sign in with your mobile number to see and cancel your rides.",
  cancel: "Cancel ride", cancelAsk: "Cancel this ride?", cancelledMsg: "Ride cancelled.",
  st_requested: "Requested", st_confirmed: "Confirmed", st_declined: "Declined", st_cancelled: "Cancelled", out: "Outbound", ret: "Return",
  loginTitle: "Sign in", yourDataTitle: "Download or delete", download: "Download my data", erase: "Delete my data",
  eraseAsk: "Delete your account and personal data? Future rides will be cancelled. This can’t be undone.", erased: "Your personal data has been deleted.",
  loginToManage: "Sign in with your mobile number to download or delete your data.",
  demoNumber: "Prototype: sign in with 600 000 000 to see a resident who already has rides.",
  footer: "Prototype for discussion. Service rules from the Ruffbus Gemeng Mamer flyer.", staffLink: "Staff screen",
},
fr: {
  demoTag: "Prototype.", banner: "Réalisé par un habitant de Holzem pour montrer à quoi pourrait ressembler la réservation en ligne. Ce n’est pas un service officiel de la Commune de Mamer : les réservations vont dans une base de test et aucun bus ne viendra.",
  bannerDemo: "N’entrez pas de vraies données personnelles : n’importe qui peut ouvrir l’écran de la centrale avec les comptes de démonstration.", bannerReset: "Tout ce qui est saisi ici est effacé chaque jour.",
  tagline: "Le minibus sur commande de la commune de Mamer", tabBook: "Réserver", tabMine: "Mes courses", tabPrivacy: "Vos données", tabAbout: "À propos du prototype",
  heroTitle: "De porte à porte à Mamer, Capellen et Holzem", heroSub: "Minibus électrique gratuit, tous les jours de 9h00 à 18h00 sauf jours fériés. Demandez votre course ici au lieu d’appeler le 2810 831.",
  stopPickup: "Départ", stopDropoff: "Arrivée", stopWhen: "Quand", stopWho: "Qui voyage", stopContact: "Vos coordonnées",
  inCommune: "Dans la commune", listedDest: "Hors commune", locality: "Localité", street: "Rue et numéro", streetPh: "p. ex. 7A route de Capellen",
  destination: "Destination", chooseDest: "Choisissez une destination", outsideHint: "Hors de la commune, le Ruffbus ne dessert que les lieux de cette liste, et uniquement pour les habitants.",
  date: "Jour", hoursHint: (l, d) => `Réservez au moins ${l} minutes et au plus ${d} jours à l’avance. Pas de service les jours fériés.`,
  time: "Heure de prise en charge", chooseTime: "Choisissez une heure", loadingTimes: "Recherche des bus libres…", tomorrow: "Demain", todayShort: "Auj.", holiday: "Férié",
  slotFree: n => n + " bus libre" + (n > 1 ? "s" : ""), slotFull: "complet", slotDays: (a, b) => `libre ${a} jours sur ${b}`,
  fullHint: "Les horaires « complet » n’ont plus de minibus libre. Choisissez une autre heure ou appelez le 2810 831.",
  returnTrip: "Ajouter un retour", returnTime: "Heure du retour", repeat: "Répéter chaque semaine", repeatDays: "Ces jours-là", repeatWeeks: "Pendant",
  weeksN: n => n + " semaine" + (n > 1 ? "s" : ""), repeatHint: "Pratique pour les trajets réguliers, comme aller chercher un enfant à la crèche. Les jours fériés sont sautés.",
  adults: "Adultes", children: "Enfants de moins de 13 ans", childrenNote: "Les enfants de moins de 13 ans voyagent avec un adulte. Gratuit pour les enfants jusqu’à 12 ans.",
  needs: "Quelque chose à signaler au chauffeur ?", needsNote: "Sert uniquement à envoyer un minibus adapté, et supprimé avec la réservation.",
  need_seat: "Siège enfant", need_stroller: "Poussette", need_wheel: "Fauteuil roulant", need_bags: "Caddie de courses",
  name: "Nom", phone: "Numéro de portable", phoneHint: "Nous vous envoyons un code à 6 chiffres par SMS pour confirmer ce numéro. Il vous permet aussi de voir et d’annuler vos courses.",
  sms: "M’envoyer un SMS quand la course est confirmée", resident: "J’habite la commune de Mamer", residentNote: "Les trajets hors commune sont réservés aux habitants.",
  signedInAs: "Connecté avec le", signOut: "Se déconnecter", sendCode: "Recevoir un code", codeLabel: "Code reçu par SMS",
  codeSent: p => `Code envoyé au ${p}. Il est valable 10 minutes.`, demoCode: "Prototype : aucun SMS n’est envoyé. Votre code est",
  verifyBook: "Confirmer et demander la course", verify: "Confirmer", resend: "Envoyer un nouveau code", changeNumber: "Changer de numéro",
  submit: "Demander la course", sending: "Envoi…",
  yourRide: "Votre course", fillIn: "Remplissez les étapes et votre course s’affiche ici.", pickupAt: "Prise en charge", returnAt: "Retour", estRide: "Trajet estimé",
  minN: n => "≈ " + n + " min", pax: (a, c) => a + " adulte" + (a > 1 ? "s" : "") + (c ? ", " + c + " enfant" + (c > 1 ? "s" : "") : ""),
  rides: n => n + " course" + (n > 1 ? "s" : ""), free: "Gratuit", price: "Prix", colNeeds: "Besoins",
  wontFit: n => n + " course" + (n > 1 ? "s" : "") + " impossible" + (n > 1 ? "s" : "") + " (aucun minibus libre)",
  errPick: "Indiquez où venir vous chercher.", errDrop: "Indiquez où vous allez.", errStreet: "Indiquez la rue et le numéro.", errDest: "Choisissez une destination de la liste.",
  errOutside: "Le départ ou l’arrivée doit se trouver à Mamer, Capellen ou Holzem.", errSame: "Le départ et l’arrivée sont identiques.",
  errDay: "Choisissez un jour.", errWindow: "Choisissez un jour dans les 7 prochains jours.", errHoliday: "Pas de service les jours fériés.", errTime: "Choisissez une heure.",
  errLead: "Réservez au moins 30 minutes à l’avance.", errRet: "Choisissez un retour au moins 30 minutes après le départ.", errDays: "Choisissez au moins un jour.",
  errSeats: "Le minibus compte 8 places.", errAdult: "Les enfants de moins de 13 ans doivent être accompagnés d’un adulte.", errRes: "Confirmez que vous habitez la commune pour sortir de la commune.",
  errName: "Indiquez votre nom.", errPhone: "Indiquez un numéro de portable pouvant recevoir des SMS.", errCode: "Ce code n’est pas le bon. Vérifiez le SMS et réessayez.",
  errCodeExpired: "Ce code a expiré ou a été essayé trop souvent. Demandez-en un nouveau.", errTooMany: "Trop de codes demandés. Attendez 15 minutes et réessayez.",
  errFull: "Aucun minibus n’est libre à cette heure. Choisissez une autre heure.", errFix: "Vérifiez les étapes en rouge.", tooLate: "Cette course a déjà commencé.",
  badTransition: "Cette course ne peut plus être modifiée.", notFound: "Introuvable.", network: "Pas de connexion. Vérifiez votre accès internet et réessayez.",
  server: "Une erreur s’est produite de notre côté. Réessayez dans une minute.", unavailable: "Le service est occupé. Réessayez dans une minute.",
  login: "Veuillez vous reconnecter.", invalid: "Vérifiez le formulaire et réessayez.", csrf: "Rechargez la page et réessayez.",
  partialAsk: (n, t) => `${n} course${n > 1 ? "s" : ""} sur ${t} ne ${n > 1 ? "peuvent" : "peut"} pas être réservée${n > 1 ? "s" : ""} : aucun minibus n’est libre.`,
  bookRest: "Réserver les autres", changeTimes: "Changer les heures",
  doneTitle: "Course demandée", doneSub: "Votre demande est dans la file de la centrale. Vous recevez un SMS dès que chaque course est confirmée.",
  doneDemo: "Prototype : les SMS sont simulés. Ouvrez l’écran de la centrale pour voir arriver votre demande.",
  ref: "Référence", skipped: "jour férié, sauté", notBooked: "Non réservé, aucun minibus libre", bookAnother: "Réserver une autre course", seeMine: "Voir mes courses",
  mineTitle: "Mes courses", mineEmpty: "Aucune course pour l’instant. Réservez-en une et elle s’affichera ici.", mineLogin: "Connectez-vous avec votre numéro de portable pour voir et annuler vos courses.",
  cancel: "Annuler la course", cancelAsk: "Annuler cette course ?", cancelledMsg: "Course annulée.",
  st_requested: "Demandée", st_confirmed: "Confirmée", st_declined: "Refusée", st_cancelled: "Annulée", out: "Aller", ret: "Retour",
  loginTitle: "Connexion", yourDataTitle: "Télécharger ou supprimer", download: "Télécharger mes données", erase: "Supprimer mes données",
  eraseAsk: "Supprimer votre compte et vos données personnelles ? Les courses à venir seront annulées. C’est définitif.", erased: "Vos données personnelles ont été supprimées.",
  loginToManage: "Connectez-vous avec votre numéro de portable pour télécharger ou supprimer vos données.",
  demoNumber: "Prototype : connectez-vous avec le 600 000 000 pour voir un habitant qui a déjà des courses.",
  footer: "Prototype pour discussion. Règles du service reprises du dépliant Ruffbus Gemeng Mamer.", staffLink: "Écran de la centrale",
},
de: {
  demoTag: "Prototyp.", banner: "Von einem Einwohner aus Holzem erstellt, um zu zeigen, wie eine Online-Buchung aussehen könnte. Kein offizieller Dienst der Gemeinde Mamer: Buchungen landen in einer Testdatenbank, und es kommt kein Bus.",
  bannerDemo: "Geben Sie keine echten persönlichen Daten ein: Mit den Demo-Konten kann jeder die Ansicht der Zentrale öffnen.", bannerReset: "Alle Eingaben werden jeden Tag gelöscht.",
  tagline: "Der Rufbus der Gemeinde Mamer", tabBook: "Fahrt buchen", tabMine: "Meine Fahrten", tabPrivacy: "Ihre Daten", tabAbout: "Über den Prototyp",
  heroTitle: "Von Haustür zu Haustür in Mamer, Capellen und Holzem", heroSub: "Kostenloser Elektro-Minibus, täglich von 9:00 bis 18:00 Uhr außer an Feiertagen. Fahrt hier anfragen statt 2810 831 anzurufen.",
  stopPickup: "Abholung", stopDropoff: "Ziel", stopWhen: "Wann", stopWho: "Wer fährt mit", stopContact: "Ihre Angaben",
  inCommune: "In der Gemeinde", listedDest: "Außerhalb der Gemeinde", locality: "Ortschaft", street: "Straße und Hausnummer", streetPh: "z. B. 7A route de Capellen",
  destination: "Ziel", chooseDest: "Ziel wählen", outsideHint: "Außerhalb der Gemeinde fährt der Rufbus nur die Orte dieser Liste an, und nur für Einwohner.",
  date: "Tag", hoursHint: (l, d) => `Mindestens ${l} Minuten und höchstens ${d} Tage im Voraus buchen. Kein Betrieb an Feiertagen.`,
  time: "Abholzeit", chooseTime: "Uhrzeit wählen", loadingTimes: "Freie Busse werden gesucht…", tomorrow: "Morgen", todayShort: "Heute", holiday: "Feiertag",
  slotFree: n => n + (n === 1 ? " Bus frei" : " Busse frei"), slotFull: "voll", slotDays: (a, b) => `an ${a} von ${b} Tagen frei`,
  fullHint: "Bei „voll“ ist kein Minibus frei. Wählen Sie eine andere Zeit oder rufen Sie 2810 831 an.",
  returnTrip: "Rückfahrt hinzufügen", returnTime: "Abholzeit Rückfahrt", repeat: "Jede Woche wiederholen", repeatDays: "An diesen Tagen", repeatWeeks: "Für",
  weeksN: n => n + (n > 1 ? " Wochen" : " Woche"), repeatHint: "Praktisch für regelmäßige Fahrten, etwa die Abholung aus der Krippe. Feiertage werden übersprungen.",
  adults: "Erwachsene", children: "Kinder unter 13", childrenNote: "Kinder unter 13 fahren mit einem Erwachsenen. Bis 12 Jahre kostenlos.",
  needs: "Muss der Fahrer etwas wissen?", needsNote: "Nur dafür, einen passenden Minibus zu schicken; wird mit der Buchung gelöscht.",
  need_seat: "Kindersitz", need_stroller: "Kinderwagen", need_wheel: "Rollstuhl", need_bags: "Einkaufstrolley",
  name: "Name", phone: "Handynummer", phoneHint: "Wir schicken Ihnen per SMS einen 6-stelligen Code, um die Nummer zu bestätigen. Damit können Sie Ihre Fahrten auch sehen und stornieren.",
  sms: "SMS, wenn meine Fahrt bestätigt ist", resident: "Ich wohne in der Gemeinde Mamer", residentNote: "Fahrten außerhalb der Gemeinde nur für Einwohner.",
  signedInAs: "Angemeldet mit", signOut: "Abmelden", sendCode: "Code per SMS", codeLabel: "Code aus der SMS",
  codeSent: p => `Code an ${p} gesendet. Er gilt 10 Minuten.`, demoCode: "Prototyp: Es wird keine SMS gesendet. Ihr Code lautet",
  verifyBook: "Bestätigen und Fahrt anfragen", verify: "Bestätigen", resend: "Neuen Code senden", changeNumber: "Nummer ändern",
  submit: "Fahrt anfragen", sending: "Wird gesendet…",
  yourRide: "Ihre Fahrt", fillIn: "Füllen Sie die Schritte aus, dann erscheint Ihre Fahrt hier.", pickupAt: "Abholung", returnAt: "Rückfahrt", estRide: "Geschätzte Fahrt",
  minN: n => "≈ " + n + " Min.", pax: (a, c) => a + (a === 1 ? " Erwachsener" : " Erwachsene") + (c ? ", " + c + (c === 1 ? " Kind" : " Kinder") : ""),
  rides: n => n + (n === 1 ? " Fahrt" : " Fahrten"), free: "Kostenlos", price: "Preis", colNeeds: "Bedarf",
  wontFit: n => n + (n === 1 ? " Fahrt" : " Fahrten") + " nicht möglich (kein Minibus frei)",
  errPick: "Wählen Sie den Abholort.", errDrop: "Wählen Sie das Ziel.", errStreet: "Geben Sie Straße und Hausnummer ein.", errDest: "Wählen Sie ein Ziel aus der Liste.",
  errOutside: "Abholort oder Ziel muss in Mamer, Capellen oder Holzem liegen.", errSame: "Abholort und Ziel sind gleich.",
  errDay: "Wählen Sie einen Tag.", errWindow: "Wählen Sie einen Tag in den nächsten 7 Tagen.", errHoliday: "Kein Betrieb an Feiertagen.", errTime: "Wählen Sie eine Abholzeit.",
  errLead: "Buchen Sie mindestens 30 Minuten im Voraus.", errRet: "Die Rückfahrt muss mindestens 30 Minuten nach der Abholung liegen.", errDays: "Wählen Sie mindestens einen Tag.",
  errSeats: "Der Minibus hat 8 Plätze.", errAdult: "Kinder unter 13 brauchen eine erwachsene Begleitperson.", errRes: "Bestätigen Sie, dass Sie in der Gemeinde wohnen.",
  errName: "Geben Sie Ihren Namen ein.", errPhone: "Geben Sie eine Handynummer für SMS ein.", errCode: "Der Code stimmt nicht. Prüfen Sie die SMS und versuchen Sie es erneut.",
  errCodeExpired: "Der Code ist abgelaufen oder wurde zu oft versucht. Fordern Sie einen neuen an.", errTooMany: "Zu viele Codes angefordert. Warten Sie 15 Minuten.",
  errFull: "Zu dieser Zeit ist kein Minibus frei. Wählen Sie eine andere Zeit.", errFix: "Prüfen Sie die rot markierten Schritte.", tooLate: "Diese Fahrt hat bereits begonnen.",
  badTransition: "Diese Fahrt kann nicht mehr geändert werden.", notFound: "Nicht gefunden.", network: "Keine Verbindung. Prüfen Sie Ihr Internet und versuchen Sie es erneut.",
  server: "Bei uns ist ein Fehler aufgetreten. Versuchen Sie es in einer Minute erneut.", unavailable: "Der Dienst ist ausgelastet. Versuchen Sie es in einer Minute erneut.",
  login: "Bitte melden Sie sich erneut an.", invalid: "Prüfen Sie das Formular und versuchen Sie es erneut.", csrf: "Laden Sie die Seite neu und versuchen Sie es erneut.",
  partialAsk: (n, t) => `${n} von ${t} Fahrten können nicht gebucht werden: Dann ist kein Minibus frei.`, bookRest: "Die anderen buchen", changeTimes: "Zeiten ändern",
  doneTitle: "Fahrt angefragt", doneSub: "Ihre Anfrage liegt bei der Zentrale. Sie erhalten eine SMS, sobald jede Fahrt bestätigt ist.",
  doneDemo: "Prototyp: SMS werden simuliert. Öffnen Sie die Ansicht der Zentrale, um Ihre Anfrage zu sehen.",
  ref: "Referenz", skipped: "Feiertag, übersprungen", notBooked: "Nicht gebucht, kein Minibus frei", bookAnother: "Weitere Fahrt buchen", seeMine: "Meine Fahrten ansehen",
  mineTitle: "Meine Fahrten", mineEmpty: "Noch keine Fahrten. Buchen Sie eine, dann erscheint sie hier.", mineLogin: "Melden Sie sich mit Ihrer Handynummer an, um Ihre Fahrten zu sehen und zu stornieren.",
  cancel: "Fahrt stornieren", cancelAsk: "Diese Fahrt stornieren?", cancelledMsg: "Fahrt storniert.",
  st_requested: "Angefragt", st_confirmed: "Bestätigt", st_declined: "Abgelehnt", st_cancelled: "Storniert", out: "Hinfahrt", ret: "Rückfahrt",
  loginTitle: "Anmelden", yourDataTitle: "Herunterladen oder löschen", download: "Meine Daten herunterladen", erase: "Meine Daten löschen",
  eraseAsk: "Konto und personenbezogene Daten löschen? Künftige Fahrten werden storniert. Das lässt sich nicht rückgängig machen.", erased: "Ihre personenbezogenen Daten wurden gelöscht.",
  loginToManage: "Melden Sie sich mit Ihrer Handynummer an, um Ihre Daten herunterzuladen oder zu löschen.",
  demoNumber: "Prototyp: Melden Sie sich mit 600 000 000 an, um einen Einwohner zu sehen, der schon Fahrten hat.",
  footer: "Prototyp zur Diskussion. Regeln aus dem Faltblatt Ruffbus Gemeng Mamer.", staffLink: "Ansicht der Zentrale",
},
pt: {
  demoTag: "Protótipo.", banner: "Feito por um morador de Holzem para mostrar como poderia funcionar a reserva online. Não é um serviço oficial da Comuna de Mamer: as reservas vão para uma base de dados de teste e nenhum autocarro virá.",
  bannerDemo: "Não introduza dados pessoais reais: qualquer pessoa pode abrir o ecrã da central com as contas de demonstração.", bannerReset: "Tudo o que for introduzido aqui é apagado todos os dias.",
  tagline: "O minibus a pedido da comuna de Mamer", tabBook: "Reservar", tabMine: "As minhas viagens", tabPrivacy: "Os seus dados", tabAbout: "Sobre o protótipo",
  heroTitle: "Porta a porta em Mamer, Capellen e Holzem", heroSub: "Minibus elétrico gratuito, todos os dias das 9h00 às 18h00, exceto feriados. Peça aqui a sua viagem em vez de ligar para o 2810 831.",
  stopPickup: "Partida", stopDropoff: "Chegada", stopWhen: "Quando", stopWho: "Quem viaja", stopContact: "Os seus contactos",
  inCommune: "Na comuna", listedDest: "Fora da comuna", locality: "Localidade", street: "Rua e número", streetPh: "p. ex. 7A route de Capellen",
  destination: "Destino", chooseDest: "Escolha um destino", outsideHint: "Fora da comuna, o Ruffbus só serve os locais desta lista, e apenas para residentes.",
  date: "Dia", hoursHint: (l, d) => `Reserve com pelo menos ${l} minutos e no máximo ${d} dias de antecedência. Sem serviço aos feriados.`,
  time: "Hora de recolha", chooseTime: "Escolha uma hora", loadingTimes: "A procurar autocarros livres…", tomorrow: "Amanhã", todayShort: "Hoje", holiday: "Feriado",
  slotFree: n => n + (n === 1 ? " autocarro livre" : " autocarros livres"), slotFull: "lotado", slotDays: (a, b) => `livre em ${a} de ${b} dias`,
  fullHint: "Nas horas «lotado» não há minibus livre. Escolha outra hora ou ligue para o 2810 831.",
  returnTrip: "Adicionar regresso", returnTime: "Hora do regresso", repeat: "Repetir todas as semanas", repeatDays: "Nestes dias", repeatWeeks: "Durante",
  weeksN: n => n + (n > 1 ? " semanas" : " semana"), repeatHint: "Útil para viagens regulares, como ir buscar uma criança à creche. Os feriados são saltados.",
  adults: "Adultos", children: "Crianças com menos de 13 anos", childrenNote: "Crianças com menos de 13 anos viajam com um adulto. Grátis até aos 12 anos.",
  needs: "Algo que o motorista deva saber?", needsNote: "Só serve para enviar um minibus adequado e é apagado com a reserva.",
  need_seat: "Cadeira de criança", need_stroller: "Carrinho de bebé", need_wheel: "Cadeira de rodas", need_bags: "Carrinho de compras",
  name: "Nome", phone: "Telemóvel", phoneHint: "Enviamos-lhe por SMS um código de 6 dígitos para confirmar o número. Com ele também pode ver e cancelar as suas viagens.",
  sms: "Enviar SMS quando a viagem for confirmada", resident: "Moro na comuna de Mamer", residentNote: "As viagens fora da comuna são só para residentes.",
  signedInAs: "Sessão iniciada com", signOut: "Terminar sessão", sendCode: "Receber código", codeLabel: "Código recebido por SMS",
  codeSent: p => `Enviámos um código para ${p}. É válido durante 10 minutos.`, demoCode: "Protótipo: nenhum SMS é enviado. O seu código é",
  verifyBook: "Confirmar e pedir viagem", verify: "Confirmar", resend: "Enviar novo código", changeNumber: "Mudar de número",
  submit: "Pedir viagem", sending: "A enviar…",
  yourRide: "A sua viagem", fillIn: "Preencha as etapas e a sua viagem aparece aqui.", pickupAt: "Recolha", returnAt: "Regresso", estRide: "Viagem estimada",
  minN: n => "≈ " + n + " min", pax: (a, c) => a + " adulto" + (a > 1 ? "s" : "") + (c ? ", " + c + " criança" + (c > 1 ? "s" : "") : ""),
  rides: n => n + (n === 1 ? " viagem" : " viagens"), free: "Grátis", price: "Preço", colNeeds: "Necessidades",
  wontFit: n => n + (n === 1 ? " viagem" : " viagens") + " sem lugar (nenhum minibus livre)",
  errPick: "Indique onde o vamos buscar.", errDrop: "Indique para onde vai.", errStreet: "Indique a rua e o número.", errDest: "Escolha um destino da lista.",
  errOutside: "A partida ou a chegada tem de ser em Mamer, Capellen ou Holzem.", errSame: "A partida e a chegada são o mesmo local.",
  errDay: "Escolha um dia.", errWindow: "Escolha um dia nos próximos 7 dias.", errHoliday: "Sem serviço aos feriados.", errTime: "Escolha uma hora.",
  errLead: "Reserve com pelo menos 30 minutos de antecedência.", errRet: "O regresso tem de ser pelo menos 30 minutos depois da partida.", errDays: "Escolha pelo menos um dia.",
  errSeats: "O minibus tem 8 lugares.", errAdult: "Crianças com menos de 13 anos têm de ir com um adulto.", errRes: "Confirme que mora na comuna para viajar para fora dela.",
  errName: "Indique o seu nome.", errPhone: "Indique um telemóvel que receba SMS.", errCode: "Esse código não está certo. Verifique o SMS e tente de novo.",
  errCodeExpired: "O código expirou ou foi tentado vezes demais. Peça um novo.", errTooMany: "Pediu códigos demais. Espere 15 minutos e tente de novo.",
  errFull: "Nenhum minibus está livre a essa hora. Escolha outra hora.", errFix: "Verifique as etapas a vermelho.", tooLate: "Esta viagem já começou.",
  badTransition: "Esta viagem já não pode ser alterada.", notFound: "Não encontrado.", network: "Sem ligação. Verifique a internet e tente de novo.",
  server: "Ocorreu um erro do nosso lado. Tente de novo dentro de um minuto.", unavailable: "O serviço está ocupado. Tente de novo dentro de um minuto.",
  login: "Inicie sessão de novo.", invalid: "Verifique o formulário e tente de novo.", csrf: "Recarregue a página e tente de novo.",
  partialAsk: (n, t) => `${n} de ${t} viagens não podem ser reservadas: nenhum minibus está livre.`, bookRest: "Reservar as outras", changeTimes: "Mudar as horas",
  doneTitle: "Viagem pedida", doneSub: "O seu pedido está na fila da central. Recebe um SMS quando cada viagem for confirmada.",
  doneDemo: "Protótipo: os SMS são simulados. Abra o ecrã da central para ver o seu pedido chegar.",
  ref: "Referência", skipped: "feriado, saltado", notBooked: "Não reservado, nenhum minibus livre", bookAnother: "Reservar outra viagem", seeMine: "Ver as minhas viagens",
  mineTitle: "As minhas viagens", mineEmpty: "Ainda sem viagens. Reserve uma e ela aparece aqui.", mineLogin: "Inicie sessão com o seu telemóvel para ver e cancelar as suas viagens.",
  cancel: "Cancelar viagem", cancelAsk: "Cancelar esta viagem?", cancelledMsg: "Viagem cancelada.",
  st_requested: "Pedida", st_confirmed: "Confirmada", st_declined: "Recusada", st_cancelled: "Cancelada", out: "Ida", ret: "Regresso",
  loginTitle: "Iniciar sessão", yourDataTitle: "Descarregar ou apagar", download: "Descarregar os meus dados", erase: "Apagar os meus dados",
  eraseAsk: "Apagar a sua conta e os seus dados pessoais? As viagens futuras serão canceladas. Não é possível anular.", erased: "Os seus dados pessoais foram apagados.",
  loginToManage: "Inicie sessão com o seu telemóvel para descarregar ou apagar os seus dados.",
  demoNumber: "Protótipo: inicie sessão com 600 000 000 para ver um morador que já tem viagens.",
  footer: "Protótipo para discussão. Regras do serviço retiradas do folheto Ruffbus Gemeng Mamer.", staffLink: "Ecrã da central",
},
};

/* Privacy notice: c = {retention, sms, audit} in days. */
const PRIVACY = {
en: c => `<h1>Your data</h1>
<p>What the booking service stores about you, why, and for how long. This describes the prototype; a live service would run under the commune of Mamer’s own data-protection rules.</p>
<table><tr><th>Data</th><th>Why</th><th>Kept</th></tr>
<tr><td>Name, mobile number, pick-up and drop-off address</td><td>To run your ride and keep you informed</td><td>Anonymised ${c.retention} days after your last ride</td></tr>
<tr><td>Needs (wheelchair, pushchair, child seat, trolley)</td><td>To send a suitable minibus. A wheelchair can reveal health information, so only the call centre and your driver see it</td><td>Deleted at the same time</td></tr>
<tr><td>Village or destination, time, number of passengers</td><td>Anonymous statistics on how the minibuses are used</td><td>Kept, with no name or address</td></tr>
<tr><td>Login codes</td><td>To confirm your number. Only a scrambled form (keyed hash) is stored</td><td>1 day</td></tr>
<tr><td>Text messages sent to you</td><td>A record of what was sent</td><td>${c.sms} days</td></tr>
<tr><td>Who changed a booking, and when</td><td>Security. You appear as a number, never by name</td><td>${c.audit} days</td></tr></table>
<h2>Who sees it</h2>
<ul><li>The call centre and the driver of your ride see your name, number, addresses and needs.</li>
<li>The commune sees anonymous figures only: rides, use of each bus, busy hours.</li>
<li>Nothing is sold or shared for advertising. The page loads no trackers, adverts, or outside fonts and scripts.</li></ul>
<h2>Cookies</h2><p>One cookie keeps you signed in for 30 days. It is strictly necessary, so there is no cookie banner. There are no analytics cookies.</p>
<h2>Your rights</h2><p>Download or delete everything stored about you below. To correct a booking, cancel it and book again, or call 2810 831. You can also complain to the CNPD, Luxembourg’s data-protection authority.</p>`,
fr: c => `<h1>Vos données</h1>
<p>Ce que le service de réservation enregistre sur vous, pourquoi et pendant combien de temps. Cette page décrit le prototype ; un vrai service fonctionnerait selon les règles de protection des données de la commune de Mamer.</p>
<table><tr><th>Données</th><th>Pourquoi</th><th>Durée</th></tr>
<tr><td>Nom, numéro de portable, adresses de départ et d’arrivée</td><td>Effectuer votre course et vous tenir informé</td><td>Anonymisées ${c.retention} jours après votre dernière course</td></tr>
<tr><td>Besoins (fauteuil roulant, poussette, siège enfant, caddie)</td><td>Envoyer un minibus adapté. Un fauteuil roulant peut révéler une information de santé : seuls la centrale et votre chauffeur le voient</td><td>Supprimés en même temps</td></tr>
<tr><td>Localité ou destination, heure, nombre de passagers</td><td>Statistiques anonymes sur l’utilisation des minibus</td><td>Conservées, sans nom ni adresse</td></tr>
<tr><td>Codes de connexion</td><td>Confirmer votre numéro. Seule une forme brouillée (hachage avec clé) est enregistrée</td><td>1 jour</td></tr>
<tr><td>SMS envoyés</td><td>Garder une trace de ce qui a été envoyé</td><td>${c.sms} jours</td></tr>
<tr><td>Qui a modifié une réservation, et quand</td><td>Sécurité. Vous n’apparaissez que sous un numéro, jamais par votre nom</td><td>${c.audit} jours</td></tr></table>
<h2>Qui y a accès</h2>
<ul><li>La centrale et le chauffeur de votre course voient votre nom, votre numéro, vos adresses et vos besoins.</li>
<li>La commune ne voit que des chiffres anonymes : courses, utilisation de chaque bus, heures chargées.</li>
<li>Rien n’est vendu ni partagé à des fins publicitaires. La page ne charge ni traceur, ni publicité, ni police ou script extérieur.</li></ul>
<h2>Cookies</h2><p>Un seul cookie vous garde connecté pendant 30 jours. Il est strictement nécessaire, d’où l’absence de bandeau cookies. Aucun cookie de mesure d’audience.</p>
<h2>Vos droits</h2><p>Téléchargez ou supprimez ci-dessous tout ce qui est enregistré sur vous. Pour corriger une réservation, annulez-la et réservez de nouveau, ou appelez le 2810 831. Vous pouvez aussi vous adresser à la CNPD, l’autorité luxembourgeoise de protection des données.</p>`,
de: c => `<h1>Ihre Daten</h1>
<p>Was der Buchungsdienst über Sie speichert, warum und wie lange. Diese Seite beschreibt den Prototyp; ein echter Dienst liefe nach den Datenschutzregeln der Gemeinde Mamer.</p>
<table><tr><th>Daten</th><th>Wozu</th><th>Dauer</th></tr>
<tr><td>Name, Handynummer, Abhol- und Zieladresse</td><td>Um Ihre Fahrt durchzuführen und Sie zu informieren</td><td>Anonymisiert ${c.retention} Tage nach Ihrer letzten Fahrt</td></tr>
<tr><td>Bedarf (Rollstuhl, Kinderwagen, Kindersitz, Trolley)</td><td>Um einen passenden Minibus zu schicken. Ein Rollstuhl kann Gesundheitsdaten verraten, daher sehen ihn nur die Zentrale und Ihr Fahrer</td><td>Gleichzeitig gelöscht</td></tr>
<tr><td>Ortschaft oder Ziel, Uhrzeit, Zahl der Fahrgäste</td><td>Anonyme Statistik zur Auslastung der Minibusse</td><td>Bleibt, ohne Namen und Adresse</td></tr>
<tr><td>Anmeldecodes</td><td>Um Ihre Nummer zu bestätigen. Gespeichert wird nur eine verschlüsselte Form (Hash mit Schlüssel)</td><td>1 Tag</td></tr>
<tr><td>Gesendete SMS</td><td>Nachweis, was gesendet wurde</td><td>${c.sms} Tage</td></tr>
<tr><td>Wer eine Buchung wann geändert hat</td><td>Sicherheit. Sie erscheinen nur als Nummer, nie mit Namen</td><td>${c.audit} Tage</td></tr></table>
<h2>Wer sie sieht</h2>
<ul><li>Die Zentrale und der Fahrer Ihrer Fahrt sehen Namen, Nummer, Adressen und Bedarf.</li>
<li>Die Gemeinde sieht nur anonyme Zahlen: Fahrten, Auslastung jedes Busses, Stoßzeiten.</li>
<li>Nichts wird verkauft oder für Werbung weitergegeben. Die Seite lädt keine Tracker, keine Werbung und keine fremden Schriften oder Skripte.</li></ul>
<h2>Cookies</h2><p>Ein einziges Cookie hält Sie 30 Tage angemeldet. Es ist unbedingt erforderlich, daher gibt es keinen Cookie-Banner. Es gibt keine Analyse-Cookies.</p>
<h2>Ihre Rechte</h2><p>Unten können Sie alles über Sie Gespeicherte herunterladen oder löschen. Um eine Buchung zu berichtigen, stornieren Sie sie und buchen neu, oder rufen Sie 2810 831 an. Sie können sich auch bei der CNPD, der luxemburgischen Datenschutzbehörde, beschweren.</p>`,
pt: c => `<h1>Os seus dados</h1>
<p>O que o serviço de reservas guarda sobre si, porquê e durante quanto tempo. Esta página descreve o protótipo; um serviço real funcionaria segundo as regras de proteção de dados da comuna de Mamer.</p>
<table><tr><th>Dados</th><th>Para quê</th><th>Duração</th></tr>
<tr><td>Nome, telemóvel, moradas de partida e chegada</td><td>Fazer a sua viagem e mantê-lo informado</td><td>Anonimizados ${c.retention} dias depois da sua última viagem</td></tr>
<tr><td>Necessidades (cadeira de rodas, carrinho de bebé, cadeira de criança, carrinho de compras)</td><td>Enviar um minibus adequado. Uma cadeira de rodas pode revelar dados de saúde, por isso só a central e o seu motorista a veem</td><td>Apagados ao mesmo tempo</td></tr>
<tr><td>Localidade ou destino, hora, número de passageiros</td><td>Estatísticas anónimas sobre o uso dos minibus</td><td>Guardados, sem nome nem morada</td></tr>
<tr><td>Códigos de acesso</td><td>Confirmar o seu número. Só é guardada uma forma baralhada (hash com chave)</td><td>1 dia</td></tr>
<tr><td>SMS enviados</td><td>Registo do que foi enviado</td><td>${c.sms} dias</td></tr>
<tr><td>Quem alterou uma reserva, e quando</td><td>Segurança. Aparece apenas como um número, nunca pelo nome</td><td>${c.audit} dias</td></tr></table>
<h2>Quem os vê</h2>
<ul><li>A central e o motorista da sua viagem veem o nome, o número, as moradas e as necessidades.</li>
<li>A comuna só vê números anónimos: viagens, uso de cada autocarro, horas de ponta.</li>
<li>Nada é vendido nem partilhado para publicidade. A página não carrega rastreadores, publicidade, nem tipos de letra ou scripts externos.</li></ul>
<h2>Cookies</h2><p>Um único cookie mantém a sessão iniciada durante 30 dias. É estritamente necessário, por isso não há aviso de cookies. Não há cookies de estatísticas.</p>
<h2>Os seus direitos</h2><p>Descarregue ou apague abaixo tudo o que está guardado sobre si. Para corrigir uma reserva, cancele-a e reserve de novo, ou ligue para o 2810 831. Também pode apresentar queixa à CNPD, a autoridade luxemburguesa de proteção de dados.</p>`,
};

const ABOUT = {
en: `<h1>About this prototype</h1>
<p>Today the Ruffbus Gemeng Mamer is booked by phone only. This prototype shows how residents could also book online, and how the call centre and the commune could follow the whole fleet.</p>
<h2>What is real</h2><ul>
<li>Bookings are stored in a database on the server, not in your browser.</li>
<li>The database itself refuses a second ride on a minibus that is already busy, so two people booking in the same second never get the same bus.</li>
<li>Web and phone bookings share the same three minibuses. The call centre confirms, declines and moves rides, takes a bus out of service, and sees use and turned-away demand.</li>
<li>Residents sign in with a one-time code sent to their mobile: no password to remember.</li>
<li>Data protection is built in: only what is needed is collected, old bookings are anonymised automatically, residents can download or delete their data, every change is logged, and the commune sees anonymous figures only.</li></ul>
<h2>What is simulated</h2><ul><li>Text messages are not sent; they appear in the staff screen. A live service would use the operator’s SMS gateway.</li><li>The sample rides and names are invented.</li></ul>
<h2>Assumptions to check with the commune</h2><ul>
<li>Bookings at least 30 minutes and up to 7 days ahead, as in other Ruffbus services. The Mamer flyer doesn’t state these limits.</li>
<li>Weekly repeat bookings are a suggestion, not a current rule.</li>
<li>Ride times are estimated by zone, plus 10 minutes to reach the passenger and 5 to board and set down. Each booking uses a whole minibus.</li></ul>`,
fr: `<h1>À propos du prototype</h1>
<p>Aujourd’hui, le Ruffbus Gemeng Mamer se réserve uniquement par téléphone. Ce prototype montre comment les habitants pourraient aussi réserver en ligne, et comment la centrale et la commune pourraient suivre toute la flotte.</p>
<h2>Ce qui est réel</h2><ul>
<li>Les réservations sont enregistrées dans une base de données sur le serveur, pas dans votre navigateur.</li>
<li>La base de données refuse elle-même une deuxième course sur un minibus déjà occupé : deux personnes qui réservent à la même seconde n’obtiennent jamais le même bus.</li>
<li>Les réservations web et téléphone se partagent les mêmes trois minibus. La centrale confirme, refuse et déplace les courses, met un bus hors service, et voit l’utilisation et la demande refusée.</li>
<li>Les habitants se connectent avec un code à usage unique envoyé sur leur portable : aucun mot de passe à retenir.</li>
<li>La protection des données est intégrée : seules les données nécessaires sont collectées, les anciennes réservations sont anonymisées automatiquement, chaque habitant peut télécharger ou supprimer ses données, chaque modification est journalisée, et la commune ne voit que des chiffres anonymes.</li></ul>
<h2>Ce qui est simulé</h2><ul><li>Les SMS ne sont pas envoyés ; ils s’affichent dans l’écran de la centrale. Un vrai service utiliserait la passerelle SMS de l’exploitant.</li><li>Les courses et les noms d’exemple sont fictifs.</li></ul>
<h2>Hypothèses à vérifier avec la commune</h2><ul>
<li>Réservation au moins 30 minutes et au plus 7 jours à l’avance, comme pour d’autres services Ruffbus. Le dépliant de Mamer ne précise pas ces délais.</li>
<li>Les réservations hebdomadaires sont une proposition, pas une règle actuelle.</li>
<li>Durées estimées par zone, plus 10 minutes pour rejoindre le passager et 5 pour monter et descendre. Chaque réservation occupe un minibus entier.</li></ul>`,
de: `<h1>Über den Prototyp</h1>
<p>Heute wird der Ruffbus Gemeng Mamer nur telefonisch gebucht. Dieser Prototyp zeigt, wie Einwohner auch online buchen könnten und wie Zentrale und Gemeinde die ganze Flotte im Blick behalten.</p>
<h2>Was echt ist</h2><ul>
<li>Buchungen werden in einer Datenbank auf dem Server gespeichert, nicht in Ihrem Browser.</li>
<li>Die Datenbank selbst verweigert eine zweite Fahrt auf einem schon belegten Minibus: Zwei Personen, die in derselben Sekunde buchen, bekommen nie denselben Bus.</li>
<li>Web- und Telefonbuchungen teilen sich dieselben drei Minibusse. Die Zentrale bestätigt, lehnt ab und verschiebt Fahrten, nimmt Busse außer Betrieb und sieht Auslastung und abgewiesene Nachfrage.</li>
<li>Einwohner melden sich mit einem Einmalcode per SMS an: kein Passwort nötig.</li>
<li>Datenschutz ist eingebaut: nur nötige Daten, automatische Anonymisierung alter Buchungen, Herunterladen und Löschen für Einwohner, Protokoll jeder Änderung, und die Gemeinde sieht nur anonyme Zahlen.</li></ul>
<h2>Was simuliert ist</h2><ul><li>SMS werden nicht verschickt; sie erscheinen in der Ansicht der Zentrale. Ein echter Dienst würde das SMS-Gateway des Betreibers nutzen.</li><li>Die Beispielfahrten und Namen sind erfunden.</li></ul>
<h2>Annahmen, die mit der Gemeinde zu klären sind</h2><ul>
<li>Buchung mindestens 30 Minuten und höchstens 7 Tage im Voraus, wie bei anderen Ruffbus-Diensten. Das Faltblatt aus Mamer nennt diese Fristen nicht.</li>
<li>Wöchentliche Wiederholungen sind ein Vorschlag, keine aktuelle Regel.</li>
<li>Fahrzeiten pro Zone geschätzt, plus 10 Minuten Anfahrt und 5 zum Ein- und Aussteigen. Jede Buchung belegt einen ganzen Minibus.</li></ul>`,
pt: `<h1>Sobre o protótipo</h1>
<p>Hoje, o Ruffbus Gemeng Mamer só se reserva por telefone. Este protótipo mostra como os moradores poderiam também reservar online, e como a central e a comuna poderiam acompanhar toda a frota.</p>
<h2>O que é real</h2><ul>
<li>As reservas ficam numa base de dados no servidor, não no seu navegador.</li>
<li>A própria base de dados recusa uma segunda viagem num minibus já ocupado: duas pessoas a reservar no mesmo segundo nunca ficam com o mesmo autocarro.</li>
<li>As reservas pela web e por telefone partilham os mesmos três minibus. A central confirma, recusa e move viagens, retira autocarros de serviço e vê o uso e a procura recusada.</li>
<li>Os moradores entram com um código único enviado para o telemóvel: sem palavra-passe.</li>
<li>A proteção de dados vem de origem: só se recolhe o necessário, as reservas antigas são anonimizadas automaticamente, cada morador pode descarregar ou apagar os seus dados, cada alteração fica registada, e a comuna só vê números anónimos.</li></ul>
<h2>O que é simulado</h2><ul><li>Os SMS não são enviados; aparecem no ecrã da central. Um serviço real usaria a plataforma de SMS do operador.</li><li>As viagens e os nomes de exemplo são fictícios.</li></ul>
<h2>Pressupostos a confirmar com a comuna</h2><ul>
<li>Reserva com pelo menos 30 minutos e no máximo 7 dias de antecedência, como noutros serviços Ruffbus. O folheto de Mamer não indica estes prazos.</li>
<li>As reservas semanais são uma proposta, não uma regra atual.</li>
<li>Durações estimadas por zona, mais 10 minutos para chegar ao passageiro e 5 para entrar e sair. Cada reserva ocupa um minibus inteiro.</li></ul>`,
};

const TS = {
en: {
  appTitle: "Call centre and fleet", staffTag: "Staff screen", loginTitle: "Staff sign-in", username: "Username", password: "Password", signIn: "Sign in", signOut: "Sign out",
  demoAccounts: "Demo accounts", useAcc: "Use", role_dispatcher: "Call centre", role_viewer: "Commune (read only)", role_admin: "Administrator",
  roleNote_dispatcher: "Sees passengers, confirms rides, takes phone bookings.", roleNote_viewer: "Sees usage only: no names, numbers or addresses.", roleNote_admin: "Everything, plus the audit log and data protection.",
  tDay: "Day", tWeek: "Week", tSms: "Text messages", tAudit: "Audit log", tData: "Data protection",
  dayTitle: "The fleet today", kpiRides: "Rides", kpiPax: "Passengers", kpiUse: "Fleet in use", kpiAway: "Turned away, full", kpiPeak: "Busiest hour", kpiWait: "Need a bus",
  timeline: "Buses through the day", waitRow: "Needs a bus", inService: "in service", outService: "out of service",
  serviceHint: "Take a bus out of service for the day (repair, charging): its rides move to “Needs a bus”.",
  outAsk: (b, d) => `Take ${b} out of service on ${d}? Its rides will need another bus.`, outDone: n => n === 1 ? "1 ride needs another bus." : n + " rides need another bus.",
  autoAssign: "Assign waiting rides", assigned: (a, w) => `${a} assigned` + (w ? `, ${w} still waiting` : ""),
  moveTo: "Move to", close: "Close", pickTrip: "Select a ride on the timeline or in the table.", noBusFree: "no other bus free",
  confirm: "Confirm", decline: "Decline", cancel: "Cancel ride", declineAsk: "Decline this ride? The passenger gets a text.", cancelAsk: "Cancel this ride? The passenger gets a text.",
  colTime: "Time", colBus: "Bus", colName: "Passenger", colFrom: "From", colTo: "To", colPax: "Seats", colNeeds: "Needs", colStatus: "Status", colRef: "Reference", colChannel: "Booked by", colPhone: "Phone", colRide: "Ride",
  ch_web: "Web", ch_phone: "Phone", st_requested: "Requested", st_confirmed: "Confirmed", st_declined: "Declined", st_cancelled: "Cancelled",
  ridesDay: "All rides this day", dispEmpty: "No rides this day.", exportCsv: "Download CSV", nowLine: "now", keyConfirmed: "Confirmed", keyRequested: "Requested, to confirm",
  viewerNote: "Anonymous view: you see how the buses are used, without names, phone numbers or addresses.", anon: "Passenger details hidden for your role",
  childrenShort: "Children (under 13)", newBooking: "New phone booking", newBookingSub: "Same rules and same three buses as web bookings, so phone and web can never double-book.",
  fPickup: "Pick-up", fDropoff: "Drop-off", fWhen: "When", fWho: "Passenger", returnOpt: "Return (optional)", none: "None", lang: "Language for texts", saveBooking: "Save booking",
  booked: r => `Booking ${r} saved and confirmed.`, partialBooked: (r, n) => `Booking ${r} saved; ${n} ride(s) didn’t fit.`,
  weekTitle: "Fleet use by hour", weekSub: "Share of bus time in use, 9:00–18:00. Darker means busier.", colDay: "Day", colAll: "Whole day", colAway: "Turned away",
  perBus: "Use per bus over these days", usageNote: "Use = minutes a bus is driving to, carrying or setting down passengers, out of 540 service minutes (9:00–18:00). Ride times are estimated by zone.",
  smsTitle: "Text messages", smsSub: "Messages handed to the SMS gateway (simulated in the prototype). Kept 7 days; login codes are stored masked.",
  colWhen: "When", colTo2: "To", colPurpose: "Type", colText: "Message", p_code: "Login code", p_confirmed: "Confirmed", p_declined: "Declined", p_cancelled: "Cancelled",
  auditTitle: "Audit log", auditSub: "Who did what. Staff appear by username; residents only by a number.", colWho: "Who", colAction: "Action", colObject: "On", colDetail: "Details",
  who_system: "system", who_resident: n => "resident #" + n,
  dataTitle: "Data protection", dataSub: "Personal data held now, and the automatic clean-up. The clean-up runs every night at 3:00.",
  d_accounts: "Resident accounts", d_bookings_with_personal_data: "Bookings with personal data", d_bookings_anonymised: "Bookings anonymised", d_due_for_anonymisation: "Due for anonymisation now",
  d_oldest_personal_data: "Oldest personal data", d_bookings_with_needs: "Bookings with needs (sensitive)", d_messages_kept: "Text messages kept", d_audit_entries: "Audit log entries",
  retTitle: "Retention rules", ret_bookings: n => `Names, phone numbers, street addresses and needs: anonymised ${n} days after the last ride.`,
  ret_sms: n => `Text messages: deleted after ${n} days.`, ret_audit: n => `Audit log: deleted after ${n} days.`, ret_codes: "Login codes: deleted after 1 day. Sessions: deleted when they expire.",
  runRetention: "Run the clean-up now", ranRetention: r => `Clean-up done: ${r.bookings_anonymised} bookings anonymised, ${r.accounts_deleted} accounts, ${r.messages_deleted} messages and ${r.login_codes_deleted} login codes deleted.`,
  rolesTitle: "Who sees what", rolesBody: "Call centre and administrator: passenger details, to run the rides. Commune (read only): usage figures without any personal data. Every action is in the audit log.",
  refreshed: "Updates every 20 seconds.", errLogin: "Wrong username or password.", errLocked: "Account locked for 15 minutes after 5 failed attempts.",
  busBusy: "That bus isn’t free at that time.", needsBus: "Give the ride a bus first.", alreadyOut: "That bus is already out of service that day.",
  forbidden: "Your role can’t do this.", partial: "Some rides didn’t fit.", saved: "Saved.", holidayNote: "Public holiday: no service.",
  pbResident: "Lives in the commune of Mamer", smsPassenger: "Text the passenger about this booking", bookingPage: "Booking page",
},
fr: {
  appTitle: "Centrale et flotte", staffTag: "Écran du personnel", loginTitle: "Connexion du personnel", username: "Identifiant", password: "Mot de passe", signIn: "Se connecter", signOut: "Se déconnecter",
  demoAccounts: "Comptes de démonstration", useAcc: "Utiliser", role_dispatcher: "Centrale", role_viewer: "Commune (lecture seule)", role_admin: "Administrateur",
  roleNote_dispatcher: "Voit les passagers, confirme les courses, prend les réservations par téléphone.", roleNote_viewer: "Voit uniquement l’utilisation : ni noms, ni numéros, ni adresses.", roleNote_admin: "Tout, plus le journal et la protection des données.",
  tDay: "Jour", tWeek: "Semaine", tSms: "SMS", tAudit: "Journal", tData: "Protection des données",
  dayTitle: "La flotte du jour", kpiRides: "Courses", kpiPax: "Passagers", kpiUse: "Flotte utilisée", kpiAway: "Refusées, complet", kpiPeak: "Heure la plus chargée", kpiWait: "Sans bus",
  timeline: "Les bus sur la journée", waitRow: "Sans bus", inService: "en service", outService: "hors service",
  serviceHint: "Mettez un bus hors service pour la journée (réparation, recharge) : ses courses passent dans « Sans bus ».",
  outAsk: (b, d) => `Mettre le ${b} hors service le ${d} ? Ses courses devront changer de bus.`, outDone: n => n + " course" + (n > 1 ? "s" : "") + " sans bus.",
  autoAssign: "Attribuer les courses en attente", assigned: (a, w) => `${a} attribuée${a > 1 ? "s" : ""}` + (w ? `, ${w} toujours en attente` : ""),
  moveTo: "Déplacer vers", close: "Fermer", pickTrip: "Sélectionnez une course sur la frise ou dans le tableau.", noBusFree: "aucun autre bus libre",
  confirm: "Confirmer", decline: "Refuser", cancel: "Annuler la course", declineAsk: "Refuser cette course ? Le passager reçoit un SMS.", cancelAsk: "Annuler cette course ? Le passager reçoit un SMS.",
  colTime: "Heure", colBus: "Bus", colName: "Passager", colFrom: "Départ", colTo: "Arrivée", colPax: "Places", colNeeds: "Besoins", colStatus: "Statut", colRef: "Référence", colChannel: "Réservé par", colPhone: "Téléphone", colRide: "Course",
  ch_web: "Web", ch_phone: "Téléphone", st_requested: "Demandée", st_confirmed: "Confirmée", st_declined: "Refusée", st_cancelled: "Annulée",
  ridesDay: "Toutes les courses du jour", dispEmpty: "Aucune course ce jour-là.", exportCsv: "Télécharger en CSV", nowLine: "maintenant", keyConfirmed: "Confirmée", keyRequested: "Demandée, à confirmer",
  viewerNote: "Vue anonyme : vous voyez l’utilisation des bus, sans noms, numéros de téléphone ni adresses.", anon: "Coordonnées masquées pour votre rôle",
  childrenShort: "Enfants (moins de 13 ans)", newBooking: "Nouvelle réservation par téléphone", newBookingSub: "Mêmes règles et mêmes trois bus que les réservations web : téléphone et web ne peuvent jamais se chevaucher.",
  fPickup: "Départ", fDropoff: "Arrivée", fWhen: "Quand", fWho: "Passager", returnOpt: "Retour (facultatif)", none: "Aucun", lang: "Langue des SMS", saveBooking: "Enregistrer la réservation",
  booked: r => `Réservation ${r} enregistrée et confirmée.`, partialBooked: (r, n) => `Réservation ${r} enregistrée ; ${n} course(s) impossible(s).`,
  weekTitle: "Utilisation de la flotte par heure", weekSub: "Part du temps de bus utilisé, 9h00–18h00. Plus foncé = plus chargé.", colDay: "Jour", colAll: "Journée", colAway: "Refusées",
  perBus: "Utilisation par bus sur ces jours", usageNote: "Utilisation = minutes pendant lesquelles un bus se rend chez le passager, le transporte ou le dépose, sur 540 minutes de service (9h00–18h00). Les durées sont estimées par zone.",
  smsTitle: "SMS", smsSub: "Messages remis à la passerelle SMS (simulée dans le prototype). Conservés 7 jours ; les codes de connexion sont masqués.",
  colWhen: "Quand", colTo2: "À", colPurpose: "Type", colText: "Message", p_code: "Code de connexion", p_confirmed: "Confirmation", p_declined: "Refus", p_cancelled: "Annulation",
  auditTitle: "Journal", auditSub: "Qui a fait quoi. Le personnel apparaît par identifiant ; les habitants seulement par un numéro.", colWho: "Qui", colAction: "Action", colObject: "Sur", colDetail: "Détails",
  who_system: "système", who_resident: n => "habitant n° " + n,
  dataTitle: "Protection des données", dataSub: "Les données personnelles détenues et le nettoyage automatique, qui tourne chaque nuit à 3h00.",
  d_accounts: "Comptes d’habitants", d_bookings_with_personal_data: "Réservations avec données personnelles", d_bookings_anonymised: "Réservations anonymisées", d_due_for_anonymisation: "À anonymiser maintenant",
  d_oldest_personal_data: "Donnée personnelle la plus ancienne", d_bookings_with_needs: "Réservations avec besoins (sensibles)", d_messages_kept: "SMS conservés", d_audit_entries: "Entrées du journal",
  retTitle: "Règles de conservation", ret_bookings: n => `Noms, numéros, adresses et besoins : anonymisés ${n} jours après la dernière course.`,
  ret_sms: n => `SMS : supprimés après ${n} jours.`, ret_audit: n => `Journal : supprimé après ${n} jours.`, ret_codes: "Codes de connexion : supprimés après 1 jour. Sessions : supprimées à expiration.",
  runRetention: "Lancer le nettoyage maintenant", ranRetention: r => `Nettoyage fait : ${r.bookings_anonymised} réservations anonymisées, ${r.accounts_deleted} comptes, ${r.messages_deleted} SMS et ${r.login_codes_deleted} codes supprimés.`,
  rolesTitle: "Qui voit quoi", rolesBody: "Centrale et administrateur : les coordonnées des passagers, pour assurer les courses. Commune (lecture seule) : les chiffres d’utilisation, sans aucune donnée personnelle. Chaque action figure au journal.",
  refreshed: "Mise à jour toutes les 20 secondes.", errLogin: "Identifiant ou mot de passe incorrect.", errLocked: "Compte verrouillé 15 minutes après 5 essais manqués.",
  busBusy: "Ce bus n’est pas libre à cette heure-là.", needsBus: "Attribuez d’abord un bus à la course.", alreadyOut: "Ce bus est déjà hors service ce jour-là.",
  forbidden: "Votre rôle ne permet pas cette action.", partial: "Certaines courses n’ont pas pu être placées.", saved: "Enregistré.", holidayNote: "Jour férié : pas de service.",
  pbResident: "Habite la commune de Mamer", smsPassenger: "Informer le passager par SMS", bookingPage: "Page de réservation",
},
};
