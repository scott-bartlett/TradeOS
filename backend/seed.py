"""
Seed Script — Development Test Data
-------------------------------------
Creates the Calloway job scenario for testing.
Run once: python seed.py

Creates:
  - Jamie (owner), Diana (office), Marcus (tech)
  - Calloway customer (residential)
  - Calloway service location
  - One test job in estimate status
"""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

from app.models import *
from app.models.user import User, UserRole
from app.models.customer import Customer, ServiceLocation, CustomerType
from app.models.job import Job, JobStatus, JobVertical

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed():
    async with AsyncSessionLocal() as db:

        print("Seeding test data...")

        # ── USERS ──────────────────────────────────────────────────────────
        jamie = User(
            clerk_id="clerk_jamie_test",
            email="jamie@tradeos-demo.com",
            first_name="Jamie",
            last_name="Owner",
            phone="(253) 555-0100",
            role=UserRole.owner,
            is_active=True
        )
        diana = User(
            clerk_id="clerk_diana_test",
            email="diana@tradeos-demo.com",
            first_name="Diana",
            last_name="Office",
            phone="(253) 555-0101",
            role=UserRole.office,
            is_active=True
        )
        marcus = User(
            clerk_id="clerk_marcus_test",
            email="marcus@tradeos-demo.com",
            first_name="Marcus",
            last_name="Tech",
            phone="(253) 555-0102",
            role=UserRole.tech,
            is_active=True
        )
        db.add_all([jamie, diana, marcus])
        await db.flush()
        print(f"  ✓ Users: Jamie ({jamie.id}), Diana ({diana.id}), Marcus ({marcus.id})")

        # ── CUSTOMER ───────────────────────────────────────────────────────
        calloway = Customer(
            customer_type=CustomerType.residential,
            first_name="Linda",
            last_name="Calloway",
            display_name="Linda Calloway",
            email="linda.calloway@email.com",
            phone="(253) 555-0182",
            mobile="(253) 555-0182",
            billing_street="2847 Ridgewood Ct",
            billing_city="Tacoma",
            billing_state="WA",
            billing_zip="98405",
            is_active=True
        )
        db.add(calloway)
        await db.flush()
        print(f"  ✓ Customer: Linda Calloway ({calloway.id})")

        # ── SERVICE LOCATION ───────────────────────────────────────────────
        calloway_location = ServiceLocation(
            customer_id=calloway.id,
            location_name="Calloway Residence",
            contact_name="Linda Calloway",
            contact_phone="(253) 555-0182",
            street="2847 Ridgewood Ct",
            city="Tacoma",
            state="WA",
            zip_code="98405",
            access_notes="Ring doorbell. Dog is friendly.",
            is_active=True
        )
        db.add(calloway_location)
        await db.flush()
        print(f"  ✓ Service Location: 2847 Ridgewood Ct ({calloway_location.id})")

        # ── TEST JOB ───────────────────────────────────────────────────────
        job = Job(
            job_number="TOS-2024-0001",
            title="Condenser Replacement — R-22 to R-410A",
            customer_id=calloway.id,
            service_location_id=calloway_location.id,
            assigned_tech_id=marcus.id,
            vertical=JobVertical.hvac,
            scope_of_work="Replace existing Goodman 3-ton R-22 condenser with Carrier CA16NA036 3-ton 16 SEER. Includes R-22 recovery, line set flush, disconnect inspection, filter drier replacement, and pad leveling.",
            estimated_hours=6.0,
            labor_rate=110.0,
            material_markup=30.0,
            status=JobStatus.estimate
        )
        db.add(job)
        await db.flush()
        print(f"  ✓ Job: {job.job_number} ({job.id})")

        await db.commit()

        print("\n✅ Seed complete!")
        print(f"\nTest IDs (save these for API testing):")
        print(f"  marcus_id:           {marcus.id}")
        print(f"  customer_id:         {calloway.id}")
        print(f"  service_location_id: {calloway_location.id}")
        print(f"  job_id:              {job.id}")


if __name__ == "__main__":
    asyncio.run(seed())
