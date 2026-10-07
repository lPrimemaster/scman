# Athlete quality-of-life ideas

Suggestions from a review of the athlete-facing app (October 2026). Items marked 🗄️ need a new
database table — allowed, since existing tables must stay untouched for production compatibility.

Status: ✅ planned/implemented in the current round · ⬜ open

## Quick wins

1. ✅ **"Por responder" at the top of Home.** One card with events still awaiting my answer,
   soonest deadline first. The event list already returns `my_status`.
2. ✅ **Answer from the list.** Inline Disponível / Indisponível on list rows, without opening the
   event dialog.
3. ✅ **Map link on the location.** Tap the location to open it in Google Maps / Apple Maps / Waze.
4. ✅ **Say what changed when an event is edited.** Push "Data alterada: 12 → 14 out" instead of only
   "Evento editado.".
5. ✅ **Change own password.** "Alterar password" (current + new) in the account menu.
6. ✅ **Less nagging deadline reminders.** Remind 7 days, 2 days and on the day instead of daily for
   a week; skip disabled and never-activated accounts.

## Medium

7. ✅ **Calendar subscription (ICS feed).** A personal, secret URL for Google / Apple Calendar that
   stays in sync (all visible events, or only the ones I'm going to).
8. ✅ **Web push notifications.** Reach athletes using the browser or the installed PWA, not only the
   native app.
9. ⬜ **"Os meus eventos" history.** Past events and answers with a small personal availability
   summary (reuses the admin statistics logic).
10. ⬜ **Calendar filters.** Toggle event types and "only events I'm going to".
11. ⬜ 🗄️ **Edit / delete own races.** Needs an `event_creators(event_id, user_id)` table.

## Bigger ideas for a cycling club

12. ⬜ 🗄️ **Lifts / transport.** "Preciso de boleia" / "Tenho N lugares" per race, with a list of
    offers and needs.
13. ⬜ 🗄️ **Short note with an answer.** "Chego às 10h", "só no sábado", shown next to the name in the
    participants list.
14. ✅ **Weather on race day.** Forecast for the event location in the event detail (free API).
15. ⬜ **Works offline.** Cached upcoming events and attachments for venues with poor signal.

## Smaller polish

- ⬜ "Seguir o sistema" option for the theme once a choice was made.
- ⬜ Countdown / highlight for events happening today or tomorrow.
- ⬜ Preview PDF attachments inside the app.
