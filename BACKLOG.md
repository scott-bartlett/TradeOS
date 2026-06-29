# TradeOS — Product Backlog

Last updated: June 29, 2026

---

## Field App

- [ ] **Offline-first PWA** — Job list pushed to device on sync so Marcus has everything without signal. Customer name, address, access notes, equipment data, scope all cached locally. Service worker + local storage + sync logic when signal returns.
- [ ] **Photo upload from field** — Currently requires internet. Needs offline queue that uploads when signal returns.
- [ ] **Access notes visible in field view** — Service location access notes (gate codes, entry instructions) should surface prominently in the Job Brief card.

---

## Invoices

- [ ] **Actual hours editable on invoice** — Jamie should be able to set actual hours worked at invoice time, separate from the estimated hours on the quote. Affects labor line item on invoice.
- [ ] **Invoice gap reconciliation** — Finish the flow where Jamie can review and adjust line items between quote and invoice before Diana's checklist.

---

## Change Orders

- [ ] **Van inventory restock flagging** — When a change order is approved and contains `from_van: true` items, flag those parts for restock on the dashboard. Tie into the van inventory model already in the DB.
- [ ] **Catalog search on change order line items** — Same Johnstone catalog search we built for the supply list, available when adding parts to a change order manually.

---

## Jobs

- [ ] **Scheduled date / arrival window** — Fields exist on the model but no UI to set them. Useful for Marcus to know when he's expected on site.
- [ ] **Actual hours field on job close** — When Marcus finishes a job, he should be able to log actual hours from the field app. Currently only editable from the office job detail page.

---

## Customers

- [ ] **"New Job" button from customer detail pre-fills customer** — Button exists but navigates to jobs page without pre-selecting the customer. Should open New Job dialog with customer already set.

---

## Dashboard

- [ ] **AI flags** — Build out the dashboard AI flags UI using the existing `generate_dashboard_flags` endpoint. Needs data to test properly — revisit after more jobs are in the system.
- [ ] **Business intelligence layer** — Profitability by job type, crew performance patterns, labor drift analysis. Needs meaningful data volume first.
- [ ] **Revenue summary** — Total quoted, invoiced, collected this month/quarter.

---

## Platform / Infrastructure

- [ ] **QuickBooks integration** — Explicitly out of MVP scope. Invoice sync after Diana approves. Customer sync on create.
- [ ] **SendGrid setup** — Currently logging to Railway console in dev. Need FROM_EMAIL and SENDGRID_API_KEY configured for real email delivery.
- [ ] **Payment link on quote PDF** — Currently shows `[Payment link — coming soon]`. Wire up a payment processor (Stripe) so customers can pay deposit online.
- [ ] **Multi-tech support** — Assign jobs to specific techs, filter field app by assigned jobs only.
- [ ] **Reminder emails** — Invoice reminders at 7, 14, 30 days overdue. Model columns exist (`reminder_7_sent`, etc.), just need the scheduler.

---

## Notes

- Keep field app online-only for MVP pilot. Offline is Phase 3.
- QuickBooks is not MVP — Jamie manually flips payment status for now.
- Dashboard AI flags need more job data before they're meaningful to test.
