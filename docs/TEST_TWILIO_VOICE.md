# Test Twilio Voice – Step by Step

Your app is running. Follow these steps to test a real call.

---

## 1. Start a tunnel (second terminal)

Twilio must reach your app over the internet. Expose port 8000:

**Option A – localtunnel (no install if you have Node):**
```bash
npx localtunnel --port 8000
```
You’ll see something like: `your url is: https://random-word-123.loca.lt`  
If it asks for your IP, press Enter or type your IP.

**Option B – ngrok (if installed):**
```bash
ngrok http 8000
```
Copy the **HTTPS** URL (e.g. `https://abc123.ngrok-free.app`).

Keep this terminal open.

---

## 2. Set your public URL in .env

Open `.env` and set `VOICE_WEBHOOK_BASE_URL` to the tunnel URL (no trailing slash):

```env
VOICE_WEBHOOK_BASE_URL=https://your-actual-tunnel-url.loca.lt
```
or
```env
VOICE_WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
```

Save the file.

---

## 3. Restart the backend

In the terminal where uvicorn is running:

- Press **Ctrl+C** to stop.
- Start again:
```bash
cd /Users/cherif/Desktop/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 4. Configure Twilio

1. Go to: **https://console.twilio.com** → **Phone Numbers** → **Manage** → **Active Numbers**.
2. Click your number **+1 855 799 7794**.
3. Under **Voice** → **A call comes in**:
   - Choose **Webhook**.
   - URL:  
     `https://YOUR-TUNNEL-URL/api/voice/incoming?business_id=1`  
     (replace `YOUR-TUNNEL-URL` with the same host you put in `.env`, e.g. `random-word-123.loca.lt` or `abc123.ngrok-free.app`; use **HTTPS**).
   - HTTP: **POST**.
4. Click **Save**.

---

## 5. Call and test

Call **+1 (855) 799-7794** from your phone.

You should:

1. Hear: “Welcome to [your business name]. How can I help you today? Please speak after the beep.”
2. Hear a beep, then speak (e.g. “What are your hours?”).
3. After a few seconds, hear the AI reply (hours, services, or appointment info).

You can speak again when prompted (“Anything else?”) for another turn (up to 10).

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Call doesn’t connect / no greeting | Check Twilio webhook URL is **HTTPS** and exactly: `https://YOUR-TUNNEL/api/voice/incoming?business_id=1`. Ensure tunnel and backend are running. |
| “Invalid configuration” | `business_id=1` must exist. Create a business in the API first (or use an existing business id). |
| Greeting then silence | Check backend logs when you speak. Twilio posts the recording to `/api/voice/recording`; if that fails, check OPENAI_API_KEY and TWILIO_AUTH_TOKEN. |
| Tunnel URL changed | localtunnel/ngrok give new URLs each run. Update `.env` and Twilio webhook, then restart uvicorn. |

To confirm the webhook is reachable, in a browser open:
`https://YOUR-TUNNEL-URL/api/voice/incoming?business_id=1`  
You may see “Method Not Allowed” (browser uses GET; Twilio uses POST). That’s fine — it means the route is reachable.
