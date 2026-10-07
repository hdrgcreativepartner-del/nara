# NARA Intelligence & Notification Architecture

## Principle
NARA must understand first, validate second, and only then save.

Flow:
1. User input / voice transcript
2. Frontend local safety parser
3. Backend `/api/interpret`
4. AI returns structured JSON matching `docs/nara-intent.schema.json`
5. NARA validates required fields
6. If incomplete: ask clarification
7. If complete: preview/save to database
8. Reminder scheduler queues notification
9. Push provider sends notification to Median app

## Median reminder
A web timer is not reliable after the app is closed. Production reminders should use:
- authenticated user/device
- server-side reminder table
- background scheduler/queue
- push provider (for example OneSignal configured in the Median app)
- notification deep link back to the relevant NARA agenda

The frontend should never contain AI provider or push-provider secret keys.

## AI contract
The model must never directly mutate data. It only returns intent JSON. The application decides whether to save, ask, update, or ignore.

Example:
User: "Target bulan ini, menyelesaikan Portofolio HDRG Creative Partner"

Expected:
```json
{
  "intent": "target",
  "confidence": 0.99,
  "entities": {
    "title": "Menyelesaikan Portofolio HDRG Creative Partner",
    "period": "monthly",
    "source_text": "Target bulan ini, menyelesaikan Portofolio HDRG Creative Partner"
  },
  "needs_clarification": false,
  "missing_fields": [],
  "clarification_question": null,
  "quick_replies": [],
  "suggested_action": "save"
}
```

Example:
User: "Sore ke Jember"

Expected action: ask for date/time before saving.
