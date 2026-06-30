"""
TradeOS Test Data Seed Script
-----------------------------
Creates realistic HVAC customers and jobs at every lifecycle stage.
Run from backend/ with venv activated:

    python seed_test_data.py

Requires DATABASE_URL env var pointing to Railway PostgreSQL.
"""

import asyncio
import httpx
import json
from datetime import datetime, timedelta

BASE_URL = "https://tradeos-production-fd2f.up.railway.app"

# ── HELPERS ───────────────────────────────────────────────────────────────────

async def post(client: httpx.AsyncClient, path: str, data: dict) -> dict:
    r = await client.post(f"{BASE_URL}{path}", json=data)
    if r.status_code not in (200, 201):
        print(f"  ❌ POST {path} → {r.status_code}: {r.text[:200]}")
        return {}
    return r.json()

async def patch(client: httpx.AsyncClient, path: str, data: dict) -> dict:
    r = await client.patch(f"{BASE_URL}{path}", json=data)
    if r.status_code not in (200, 201):
        print(f"  ❌ PATCH {path} → {r.status_code}: {r.text[:200]}")
        return {}
    return r.json()

async def get(client: httpx.AsyncClient, path: str) -> dict:
    r = await client.get(f"{BASE_URL}{path}")
    return r.json()

def ok(label: str):
    print(f"  ✓ {label}")

# ── CUSTOMERS ─────────────────────────────────────────────────────────────────

CUSTOMERS = [
    {
        "customer_type": "residential",
        "first_name": "Robert",
        "last_name": "Harmon",
        "display_name": "Robert Harmon",
        "email": "robert.harmon@email.com",
        "phone": "(615) 555-0142",
        "billing_street": "2847 Maple Grove Rd",
        "billing_city": "Nashville",
        "billing_state": "TN",
        "billing_zip": "37205",
        "location": {
            "street": "2847 Maple Grove Rd",
            "city": "Nashville",
            "state": "TN",
            "zip_code": "37205",
            "access_notes": "Dog in backyard. Unit is behind the fence gate on the left.",
        }
    },
    {
        "customer_type": "residential",
        "first_name": "Patricia",
        "last_name": "Nguyen",
        "display_name": "Patricia Nguyen",
        "email": "p.nguyen@gmail.com",
        "phone": "(615) 555-0278",
        "billing_street": "511 Ridgecrest Dr",
        "billing_city": "Brentwood",
        "billing_state": "TN",
        "billing_zip": "37027",
        "location": {
            "street": "511 Ridgecrest Dr",
            "city": "Brentwood",
            "state": "TN",
            "zip_code": "37027",
        }
    },
    {
        "customer_type": "commercial",
        "company_name": "Riverside Property Management",
        "first_name": "Derek",
        "last_name": "Okafor",
        "display_name": "Riverside Property Management",
        "email": "d.okafor@riversidepm.com",
        "phone": "(615) 555-0391",
        "billing_street": "100 Commerce St Suite 800",
        "billing_city": "Nashville",
        "billing_state": "TN",
        "billing_zip": "37201",
        "location": {
            "location_name": "Riverside Plaza",
            "contact_name": "Derek Okafor",
            "contact_phone": "(615) 555-0391",
            "street": "450 Riverside Dr",
            "city": "Nashville",
            "state": "TN",
            "zip_code": "37206",
            "access_notes": "Check in with building manager on arrival. HVAC room is B-12 in basement.",
        }
    },
    {
        "customer_type": "residential",
        "first_name": "Sandra",
        "last_name": "Kowalski",
        "display_name": "Sandra Kowalski",
        "email": "sandrak@outlook.com",
        "phone": "(615) 555-0514",
        "billing_street": "88 Willow Creek Ln",
        "billing_city": "Franklin",
        "billing_state": "TN",
        "billing_zip": "37064",
        "location": {
            "street": "88 Willow Creek Ln",
            "city": "Franklin",
            "state": "TN",
            "zip_code": "37064",
        }
    },
    {
        "customer_type": "commercial",
        "company_name": "Eastside Medical Group",
        "first_name": "Linda",
        "last_name": "Torres",
        "display_name": "Eastside Medical Group",
        "email": "facilities@eastsidemedical.com",
        "phone": "(615) 555-0629",
        "billing_street": "3300 Gallatin Pike",
        "billing_city": "Nashville",
        "billing_state": "TN",
        "billing_zip": "37216",
        "location": {
            "location_name": "Eastside Medical — Main Clinic",
            "contact_name": "Linda Torres",
            "contact_phone": "(615) 555-0629",
            "street": "3300 Gallatin Pike",
            "city": "Nashville",
            "state": "TN",
            "zip_code": "37216",
            "access_notes": "After-hours access code: 7742. Rooftop units accessible via stairwell C.",
        }
    },
    {
        "customer_type": "residential",
        "first_name": "Marcus",
        "last_name": "Webb",
        "display_name": "Marcus Webb",
        "email": "marcus.webb@icloud.com",
        "phone": "(615) 555-0733",
        "billing_street": "1204 Sylvan Park Ave",
        "billing_city": "Nashville",
        "billing_state": "TN",
        "billing_zip": "37212",
        "location": {
            "street": "1204 Sylvan Park Ave",
            "city": "Nashville",
            "state": "TN",
            "zip_code": "37212",
        }
    },
]

# ── JOBS BY STAGE ─────────────────────────────────────────────────────────────

async def seed_estimate(client, customer_id, location_id, title, scope):
    """Stage 1 — Just created, no work done yet."""
    job = await post(client, "/api/jobs/", {
        "title": title,
        "vertical": "hvac",
        "customer_id": customer_id,
        "service_location_id": location_id,
        "scope_of_work": scope,
        "labor_rate": 110,
        "material_markup": 30,
    })
    job_id = job.get("job_id")
    if job_id:
        ok(f"Estimate: {title} ({job_id[:8]}...)")
    return job_id


async def seed_quoted(client, customer_id, location_id, title, scope, quote_total, deposit):
    """Stage 2 — Quote sent, waiting on deposit."""
    job = await post(client, "/api/jobs/", {
        "title": title,
        "vertical": "hvac",
        "customer_id": customer_id,
        "service_location_id": location_id,
        "scope_of_work": scope,
        "labor_rate": 110,
        "material_markup": 30,
    })
    job_id = job.get("job_id")
    if not job_id:
        return None

    # Save pricing
    await post(client, f"/api/jobs/{job_id}/pricing", {
        "estimated_hours": 6,
        "labor_rate": 110,
        "material_markup": 30,
        "quote_total": quote_total,
        "internal_cost": quote_total * 0.6,
    })

    # Set deposit
    await patch(client, f"/api/jobs/{job_id}/deposit", {
        "deposit_required": deposit,
        "deposit_received": False,
    })

    # Mark as quoted
    await patch(client, f"/api/jobs/{job_id}", {"status": "quoted", "quote_sent_at": datetime.utcnow().isoformat()})
    ok(f"Quoted: {title} — ${quote_total:,} (${deposit} deposit pending)")
    return job_id


async def seed_in_progress(client, customer_id, location_id, title, scope, quote_total, deposit):
    """Stage 3 — Deposit received, supply order sent, work in progress."""
    job = await post(client, "/api/jobs/", {
        "title": title,
        "vertical": "hvac",
        "customer_id": customer_id,
        "service_location_id": location_id,
        "scope_of_work": scope,
        "labor_rate": 110,
        "material_markup": 30,
    })
    job_id = job.get("job_id")
    if not job_id:
        return None

    await post(client, f"/api/jobs/{job_id}/pricing", {
        "estimated_hours": 8,
        "labor_rate": 110,
        "material_markup": 30,
        "quote_total": quote_total,
        "internal_cost": quote_total * 0.58,
    })

    await patch(client, f"/api/jobs/{job_id}/deposit", {
        "deposit_required": deposit,
        "deposit_received": True,
    })

    # Add field notes
    await post(client, f"/api/jobs/{job_id}/field-notes", {
        "note_text": "On site. Unit is a 2019 Carrier 3-ton. Capacitor is burned out, compressor drawing high amps. Starting replacement now.",
        "tech_id": "c262b631-9d86-4b86-8996-3c3d6ad5657c",
        "note_type": "dictation",
        "client_uuid": f"seed-note-1-{job_id[:8]}",
        "captured_at": (datetime.utcnow() - timedelta(hours=3)).isoformat(),
    })

    await patch(client, f"/api/jobs/{job_id}", {"status": "in_progress"})
    ok(f"In Progress: {title} — ${quote_total:,} (deposit received)")
    return job_id


async def seed_complete(client, customer_id, location_id, title, scope, quote_total, deposit):
    """Stage 4 — Work done, ready to invoice."""
    job = await post(client, "/api/jobs/", {
        "title": title,
        "vertical": "hvac",
        "customer_id": customer_id,
        "service_location_id": location_id,
        "scope_of_work": scope,
        "labor_rate": 110,
        "material_markup": 30,
    })
    job_id = job.get("job_id")
    if not job_id:
        return None

    await post(client, f"/api/jobs/{job_id}/pricing", {
        "estimated_hours": 7,
        "labor_rate": 110,
        "material_markup": 30,
        "quote_total": quote_total,
        "internal_cost": quote_total * 0.57,
    })

    await patch(client, f"/api/jobs/{job_id}/deposit", {
        "deposit_required": deposit,
        "deposit_received": True,
    })

    # Field notes
    await post(client, f"/api/jobs/{job_id}/field-notes", {
        "note_text": "Job complete. Replaced condenser fan motor and capacitor. System running at proper pressures. Customer satisfied.",
        "tech_id": "c262b631-9d86-4b86-8996-3c3d6ad5657c",
        "note_type": "dictation",
        "client_uuid": f"seed-note-2-{job_id[:8]}",
        "captured_at": (datetime.utcnow() - timedelta(days=1)).isoformat(),
    })

    await patch(client, f"/api/jobs/{job_id}", {"status": "complete"})
    ok(f"Complete: {title} — ${quote_total:,} (ready to invoice)")
    return job_id


async def seed_invoiced(client, customer_id, location_id, title, scope, quote_total, deposit):
    """Stage 5 — Invoice built and sent."""
    job = await post(client, "/api/jobs/", {
        "title": title,
        "vertical": "hvac",
        "customer_id": customer_id,
        "service_location_id": location_id,
        "scope_of_work": scope,
        "labor_rate": 110,
        "material_markup": 30,
    })
    job_id = job.get("job_id")
    if not job_id:
        return None

    await post(client, f"/api/jobs/{job_id}/pricing", {
        "estimated_hours": 5,
        "labor_rate": 110,
        "material_markup": 30,
        "quote_total": quote_total,
        "internal_cost": quote_total * 0.6,
    })

    await patch(client, f"/api/jobs/{job_id}/deposit", {
        "deposit_required": deposit,
        "deposit_received": True,
    })

    await patch(client, f"/api/jobs/{job_id}", {"status": "complete"})

    # Build invoice
    invoice = await post(client, f"/api/invoices/build/{job_id}", {})
    invoice_id = invoice.get("invoice_id")
    if not invoice_id:
        ok(f"Invoiced (invoice build failed): {title}")
        return job_id

    # Check all Diana boxes
    await patch(client, f"/api/invoices/{invoice_id}/review", {
        "review_lines_verified": True,
        "review_hours_verified": True,
        "review_co_verified": True,
        "review_nocharge_verified": True,
        "review_total_verified": True,
    })

    # Mark as sent (bypass email)
    await patch(client, f"/api/invoices/{invoice_id}", {"status": "sent", "sent_at": (datetime.utcnow() - timedelta(days=5)).isoformat()})
    await patch(client, f"/api/jobs/{job_id}", {"status": "invoiced"})

    ok(f"Invoiced: {title} — ${quote_total:,} (invoice sent)")
    return job_id


async def seed_paid(client, customer_id, location_id, title, scope, quote_total, deposit):
    """Stage 6 — Fully paid."""
    job = await post(client, "/api/jobs/", {
        "title": title,
        "vertical": "hvac",
        "customer_id": customer_id,
        "service_location_id": location_id,
        "scope_of_work": scope,
        "labor_rate": 110,
        "material_markup": 30,
    })
    job_id = job.get("job_id")
    if not job_id:
        return None

    await post(client, f"/api/jobs/{job_id}/pricing", {
        "estimated_hours": 4,
        "labor_rate": 110,
        "material_markup": 30,
        "quote_total": quote_total,
        "internal_cost": quote_total * 0.62,
    })

    await patch(client, f"/api/jobs/{job_id}/deposit", {
        "deposit_required": deposit,
        "deposit_received": True,
    })

    await patch(client, f"/api/jobs/{job_id}", {"status": "complete"})

    invoice = await post(client, f"/api/invoices/build/{job_id}", {})
    invoice_id = invoice.get("invoice_id")
    if not invoice_id:
        ok(f"Paid (invoice build failed): {title}")
        return job_id

    await patch(client, f"/api/invoices/{invoice_id}/review", {
        "review_lines_verified": True,
        "review_hours_verified": True,
        "review_co_verified": True,
        "review_nocharge_verified": True,
        "review_total_verified": True,
    })

    await patch(client, f"/api/invoices/{invoice_id}", {
        "status": "sent",
        "sent_at": (datetime.utcnow() - timedelta(days=14)).isoformat()
    })

    # Mark paid
    await post(client, f"/api/invoices/{invoice_id}/mark-paid", {
        "amount_paid": quote_total - deposit
    })

    ok(f"Paid: {title} — ${quote_total:,} ✓")
    return job_id


# ── MAIN ──────────────────────────────────────────────────────────────────────

async def main():
    print("\n🌱 TradeOS Test Data Seed")
    print("=" * 50)

    async with httpx.AsyncClient(timeout=30) as client:

        # Check API is up
        r = await client.get(f"{BASE_URL}/health")
        if r.status_code != 200:
            print(f"❌ API not responding at {BASE_URL}")
            return
        print(f"✓ API online\n")

        # ── Create customers ──────────────────────────────────────────────────
        print("Creating customers...")
        customer_ids = []
        location_ids = []

        for c in CUSTOMERS:
            loc_data = c.pop("location")
            result = await post(client, "/api/customers/", c)
            cid = result.get("customer_id")
            if not cid:
                print(f"  ❌ Failed to create {c['display_name']}")
                continue

            # Add service location
            loc_result = await post(client, f"/api/customers/{cid}/locations", loc_data)
            lid = loc_result.get("location_id")

            customer_ids.append(cid)
            location_ids.append(lid)
            ok(f"{c['display_name']} → {cid[:8]}...")

        if len(customer_ids) < 6:
            print("❌ Not enough customers created, aborting")
            return

        print(f"\n✓ {len(customer_ids)} customers created\n")

        # ── Seed jobs at each stage ───────────────────────────────────────────
        print("Creating jobs at all lifecycle stages...\n")

        # Stage 1 — Estimates (2 jobs)
        print("── Stage 1: Estimates ──")
        await seed_estimate(client, customer_ids[0], location_ids[0],
            "AC Tune-Up & Filter Replacement",
            "Annual maintenance visit. Customer reports reduced airflow and warm spots in back bedrooms. Check refrigerant levels, clean coils, replace filters.")

        await seed_estimate(client, customer_ids[3], location_ids[3],
            "Heat Pump Inspection",
            "Customer says system is making a grinding noise on startup. Inspect heat pump, check bearings, evaluate overall system condition.")

        # Stage 2 — Quoted (2 jobs)
        print("\n── Stage 2: Quoted ──")
        await seed_quoted(client, customer_ids[1], location_ids[1],
            "Condenser Unit Replacement",
            "2009 Lennox condenser has failed. Recommend full replacement with 3-ton Carrier unit. Line set in good condition, can reuse.",
            5800, 1500)

        await seed_quoted(client, customer_ids[2], location_ids[2],
            "Commercial Rooftop Unit Repair",
            "RTU-2 on roof is not cooling. Diagnosed failed compressor contactor and low refrigerant. Recommend contactor replacement and R-410A recharge.",
            2400, 600)

        # Stage 3 — In Progress (2 jobs)
        print("\n── Stage 3: In Progress ──")
        await seed_in_progress(client, customer_ids[4], location_ids[4],
            "Dual Zone System Installation",
            "Install new dual-zone mini-split system. 2 indoor heads (bedroom and office), 1 outdoor unit. Customer has existing line set rough-in from previous contractor.",
            7200, 2000)

        await seed_in_progress(client, customer_ids[0], location_ids[0],
            "Furnace Heat Exchanger Replacement",
            "Carbon monoxide leak detected during inspection. Heat exchanger cracked. Replace heat exchanger, test and certify system safe.",
            3100, 800)

        # Stage 4 — Complete, ready to invoice (2 jobs)
        print("\n── Stage 4: Complete (Ready to Invoice) ──")
        await seed_complete(client, customer_ids[5], location_ids[5],
            "Capacitor & Contactor Replacement",
            "AC unit not starting. Diagnosed failed run capacitor and worn contactor. Replace both components, verify system operation.",
            850, 0)

        await seed_complete(client, customer_ids[3], location_ids[3],
            "Ductwork Seal & Rebalance",
            "Customer complaining of hot/cold spots throughout home. Inspect ductwork, seal leaks with mastic, rebalance airflow to all zones.",
            1650, 400)

        # Stage 5 — Invoiced, awaiting payment (2 jobs)
        print("\n── Stage 5: Invoiced ──")
        await seed_invoiced(client, customer_ids[2], location_ids[2],
            "RTU-1 Preventive Maintenance",
            "Annual PM on rooftop unit 1. Clean coils, check refrigerant, lubricate bearings, replace belts and filters.",
            1200, 0)

        await seed_invoiced(client, customer_ids[1], location_ids[1],
            "Thermostat Upgrade — Smart Control",
            "Replace existing programmable thermostat with Ecobee SmartThermostat. Configure scheduling and remote access for customer.",
            650, 0)

        # Stage 6 — Fully paid (2 jobs)
        print("\n── Stage 6: Paid ──")
        await seed_paid(client, customer_ids[4], location_ids[4],
            "Emergency AC Repair — Refrigerant Leak",
            "Emergency call. System not cooling. Located refrigerant leak at evaporator coil fitting. Repair leak, recharge with R-410A, verify operation.",
            1450, 0)

        await seed_paid(client, customer_ids[5], location_ids[5],
            "Air Handler Blower Motor Replacement",
            "Air handler running but no airflow. Failed blower motor. Replace motor and capacitor, clean blower wheel.",
            980, 0)

        print("\n" + "=" * 50)
        print("✅ Seed complete!")
        print(f"   6 customers created")
        print(f"   12 jobs across all lifecycle stages")
        print(f"\nOpen the dashboard to see your data:")
        print(f"   https://trade-os-pi-three.vercel.app/dashboard")
        print()


if __name__ == "__main__":
    asyncio.run(main())
