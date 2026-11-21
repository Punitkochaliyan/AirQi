# AirQi — SmogShield AI
### Urban Smog Defense & Community Exposure Mitigation Engine

AirQi is a lightweight, high-performance web application designed to help families, commuters, and neighborhood communities navigate severe winter smog and urban air pollution. Grounded in CPCB National AQI breakpoints, WHO 2021 particulate guidelines, and clinical IAQ trials (NIH RAPIDS).

---

## Key Features

- **CPCB & WHO 2021 Aligned**: Real-time piecewise breakpoint interpolation matching Central Pollution Control Board (CPCB) standards and WHO 2021 24-hr guideline (15 µg/m³ PM2.5).
- **Context-Aware Profiles**:
  - **Household**: Families with Children, Seniors / Multi-Gen, Commuters, RWA / Community Leads.
  - **Commute Mode**: Two-Wheeler / Walking, Petrol/Diesel Car, Metro / Public Transit, Work From Home.
  - **Indoor Filtration**: Certified True-HEPA, DIY Budget / No Purifier, Split AC Recirculation.
- **Three Actionable Recommendation Tracks**:
  1. **Low-Emission Daily Routines**: Planetary boundary layer mixing window (1:00–4:00 PM), fit-tested dual-strap N95 masking, errand batching, post-commute airway cleansing.
  2. **Indoor Air Quality (IAQ) Hacks**: NIH RAPIDS-grounded True-HEPA protocol (-53% to -60% personal exposure), open-source DIY Corsi-Rosenthal box fans, induction cooking source control, electrostatic wet mopping, door draft weatherstripping.
  3. **Sustainable & Community Actions**: School-gate zero-idling pledges, RWA leaf composting pits, Metro/EV carpooling, and electric radiant heaters for night guards.
- **Real-Time Exposure Impact Simulator**: Live interactive comparison between outdoor ambient PM2.5, unmitigated indoor infiltration, shielded indoor PM2.5, and daily CO₂e avoided (kg/day) with zero-dependency canvas bar chart.
- **GenAI Smog Advisor**: Deterministic, context-aware conversational advisor providing quantified answers with strict XSS sanitization.
- **Automated Verification & 10,000-Iteration Stress Suite**: In-browser and CLI automated testing suite that stress-tests edge-case AQIs, invariant properties, and XSS fuzz payloads in < 100 ms.

---

## Architecture & Code Quality

- `app-core.js`: Pure mathematical domain logic (`DomainLogic`), immutable configuration (`CONFIG`), and security utilities (`Security`).
- `app.js`: Presentation layer featuring cached DOM references (`cacheDom()`), event delegation, `requestAnimationFrame` drag batching, and keyboard-accessible ARIA tabs/modals.
- `style.css`: Minimalist, distraction-free aesthetic meeting WCAG 2.1 AA color contrast standards (body text 14.5:1, interactive focus rings).
- `index.html`: Fully semantic HTML5 shell with accessibility landmarks and live regions.

---

## Verification & Self-Testing

To run the automated verification and 10,000-iteration stress suite in terminal:

```bash
node test-runner.js
node verify-app.js
```

Or open `index.html` in any modern web browser and click **Run Checks** in the header.

---

## License

MIT License.
