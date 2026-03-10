---
name: morning-briefing
description: >
  Generate the user's daily morning briefing with weather, calendar, todos, and health data.
  USE WHEN: Cron job triggers morning briefing, or user asks "was steht heute an?", "briefing", "Tagesüberblick".
  DON'T USE WHEN: User asks about a specific calendar event (just check calendar directly). Not for weekly/monthly reviews (use reviews skill).
  OUTPUTS: Formatted briefing message delivered to Discord #Allgemein.
---

# Morning Briefing

Kompaktes Daily Briefing für the user — Wetter, Termine, Todos, Health.

## Datenquellen

### 1. Wetter (your city)
```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=YOUR_LAT&longitude=YOUR_LON&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBerlin"
```

Weather Codes: 0=☀️, 1-3=⛅/☁️, 45-48=🌫️, 51-67=🌧️, 71-77=🌨️, 80-82=🌦️, 95-99=⛈️

### 2. Kalender
```bash
python3 ~/workspace/tools/google-calendar.py list 2
```

### 3. Top 5 Todos
Lies: `/path/to/obsidian/vault/Todo.md`
Extrahiere die 5 wichtigsten offenen Tasks.

### 4. Whoop Health Data
```bash
python3 /path/to/workspace/skills/whoop-health-analysis/scripts/whoop_data.py summary --days 1
python3 /path/to/workspace/skills/whoop-health-analysis/scripts/whoop_data.py summary --days 7
python3 /path/to/workspace/skills/whoop-health-analysis/scripts/whoop_data.py summary --days 30
```

## Output Format

```
☀️ **Wetter:** 12°C, sonnig | Max 15°C | Regen: 10%

📅 **Termine:**
- 09:00 Call mit Kai
- 14:00 Zahnarzt

✅ **Top Todos:**
1. Years Landing Page finalisieren
2. Newsletter schreiben
3. ...

🛌 **Schlaf:** X.Xh (Performance: XX%)
📊 **7-Tage-Ø:** X.Xh (XX%) | **30-Tage-Ø:** X.Xh (XX%)
🔄 **Recovery:** XX%
❤️ **HRV:** XXms (RHR: XXbpm)
😴 **REM:** Xh XXmin (XX%)
💡 **Erkenntnis:** [1 konkreter Tipp basierend auf Daten]
```

## Delivery
- **Mo-Fr:** Discord #Allgemein (GENERAL_CHANNEL_ID) um 7:00
- **Sa-So:** Discord #Allgemein um 8:00
- Format: Kompakt, scanbar, mit Emojis
- Keine Filler-Texte, keine Einleitungen
