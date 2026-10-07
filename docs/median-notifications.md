# Median.co notification bridge for NARA

NARA includes `median-bridge.js`, which integrates the Median JavaScript Bridge with OneSignal without exposing secret API keys in the web app.

## Median App Studio

1. Open **Native Plugins → OneSignal**.
2. Enable the plugin and enter the OneSignal App ID.
3. Rebuild the Android/iOS app after enabling the plugin.
4. If you want NARA to ask at a deliberate moment, disable OneSignal auto-register; NARA's notification button calls `median.onesignal.register()`.
5. NARA enables foreground notifications for the current app session with `median.onesignal.enableForegroundNotifications(true)`.

NARA associates the install with a generated stable anonymous external ID through `median.onesignal.login(externalId)`, and reads `oneSignalId` / subscription ID via `onesignalInfo()` or `info()`.

## Background reminder delivery

The JavaScript bridge registers the device, but a GitHub Pages app cannot safely contain a OneSignal REST API Key and cannot reliably run a timer after the app is killed.

For real reminder delivery, deploy a small backend endpoint and configure its URL before NARA starts:

```html
<script>
  window.NARA_PUSH_ENDPOINT = "https://your-api.example.com/nara/reminders";
</script>
```

When an agenda is saved, NARA POSTs:

```json
{
  "externalId": "nara_...",
  "oneSignalId": "...",
  "subscriptionId": "...",
  "reminder": {
    "id": "...",
    "title": "Meeting",
    "date": "2026-10-10",
    "time": "21:00",
    "leadMinutes": 30,
    "targetUrl": "https://your-nara-url/#today"
  }
}
```

The server should compute `send_after = agenda time - leadMinutes` and call the OneSignal REST API using the REST API Key stored only on the server. Include `targetUrl` and `agendaId` in Additional Data so Median opens the correct in-app page and NARA can scroll to the agenda.

## Notification tap

NARA defines `median_onesignal_push_opened(data)`. If the payload contains `agendaId`, NARA opens the Hari Ini page and scrolls to that agenda.

## Important

Do not place the OneSignal REST API Key in `index.html`, `app.js`, GitHub Pages secrets exposed to the browser, or `median-bridge.js`.
