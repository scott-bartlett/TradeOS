"""
AI Provider Abstraction Layer
-----------------------------
All AI calls go through this interface.
Swap the provider by changing AI_PROVIDER in .env — no app code changes needed.

Current provider: Anthropic Claude
  - Vision:    Claude reads equipment photos, data plates, job site conditions
  - Reasoning: Supply list generation, quote suggestions, job summaries
  - Text:      Dashboard flags, change order drafts, follow-up suggestions

Future providers (drop-in replacements):
  - OpenAI GPT-4o (set AI_PROVIDER=openai)
"""

import anthropic
import base64
import httpx
import json
from app.config import get_settings

settings = get_settings()


def _get_client():
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


# ── PHOTO ANALYSIS ────────────────────────────────────────────────────────────

PHOTO_ANALYSIS_PROMPT = """You are an expert HVAC technician's assistant analyzing job site photos.

Analyze the provided photo(s) and extract all equipment information you can identify.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "manufacturer": "string or null",
  "model_number": "string or null",
  "serial_number": "string or null",
  "manufacture_year": "string or null",
  "equipment_type": "string (e.g. condenser, air handler, furnace, heat pump)",
  "tonnage": "string or null (e.g. 3-ton, 36000 BTU)",
  "refrigerant": "string or null (e.g. R-22, R-410A)",
  "voltage": "string or null",
  "max_breaker": "string or null",
  "condition": "good|fair|poor|critical",
  "age_years": "number or null",
  "flags": [
    {
      "severity": "critical|warning|info",
      "message": "string describing the issue"
    }
  ],
  "follow_up_questions": ["string"],
  "raw_data_plate_text": "string — all text visible on the data plate"
}

Be precise with model numbers and serial numbers — they are used for parts ordering.
Flag R-22 refrigerant as critical (federally phased out).
Flag units over 15 years old as a warning.
Flag visible damage, heavy fouling, or pad issues."""


async def analyze_photo(photo_url: str) -> dict:
    """
    Analyze a job site photo using Claude Vision.
    Returns structured equipment data.
    
    Args:
        photo_url: Public URL of the photo (from R2)
    
    Returns:
        dict with equipment details, flags, and follow-up questions
    """
    client = _get_client()

    # Fetch the image and convert to base64 for Claude
    async with httpx.AsyncClient() as http:
        response = await http.get(photo_url)
        response.raise_for_status()
        image_data = base64.standard_b64encode(response.content).decode("utf-8")
        content_type = response.headers.get("content-type", "image/jpeg")

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": content_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": PHOTO_ANALYSIS_PROMPT
                    }
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Strip any accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    
    return json.loads(raw.strip())


# ── SUPPLY LIST GENERATION ────────────────────────────────────────────────────

SUPPLY_LIST_PROMPT = """You are an expert HVAC supply list generator.

Given equipment analysis data and a technician's scope dictation, generate a complete supply list for the job.

Equipment data:
{equipment_data}

Technician dictation:
{dictation}

Vertical: {vertical}

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
[
  {{
    "sku": "string or null — use Johnstone Supply SKU format if known",
    "description": "string — clear part description",
    "quantity": number,
    "unit": "string (ea, ft, lb, kit, set, pk, cyl, roll)",
    "estimated_unit_cost": number,
    "source": "photo|dictation|inferred",
    "notes": "string or null — why this item is needed"
  }}
]

Rules:
- Include ALL materials needed for a complete professional job
- source = "photo" if identified from equipment analysis
- source = "dictation" if tech mentioned it explicitly  
- source = "inferred" if standard for this job type
- For R-22 to R-410A conversions, always include: recovery cylinder, line set flush kit, filter drier
- Always include consumables: foil tape, zip ties, wire nuts as needed
- Be conservative on quantities — tech can adjust
- estimated_unit_cost should reflect current trade pricing"""


async def generate_supply_list(
    equipment_data: dict,
    dictation: str,
    vertical: str = "hvac"
) -> list:
    """
    Generate a supply list from photo analysis + technician dictation.
    
    Args:
        equipment_data: Result from analyze_photo()
        dictation:      Tech's scope dictation text
        vertical:       Trade vertical (hvac, electrical, pipefitting)
    
    Returns:
        List of supply items with SKU, description, quantity, cost, source
    """
    client = _get_client()

    prompt = SUPPLY_LIST_PROMPT.format(
        equipment_data=json.dumps(equipment_data, indent=2),
        dictation=dictation,
        vertical=vertical
    )

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw.strip())


# ── QUOTE PRICE SUGGESTION ────────────────────────────────────────────────────

async def suggest_quote_price(
    supply_items: list,
    labor_hours: float,
    labor_rate: float,
    markup_pct: float,
    vertical: str = "hvac",
    location: str = "Pacific Northwest"
) -> dict:
    """
    Suggest a customer-facing quote price based on costs and market rates.
    
    Returns:
        dict with suggested_price, margin_pct, and reasoning
    """
    client = _get_client()

    material_cost = sum(
        item.get("quantity", 1) * item.get("estimated_unit_cost", 0)
        for item in supply_items
    )
    labor_cost = labor_hours * labor_rate
    internal_cost = material_cost * (1 + markup_pct / 100) + labor_cost

    prompt = f"""You are a trades business pricing advisor.

Internal cost breakdown:
- Materials (with {markup_pct}% markup): ${material_cost * (1 + markup_pct/100):.2f}
- Labor ({labor_hours} hrs @ ${labor_rate}/hr): ${labor_cost:.2f}
- Total internal cost: ${internal_cost:.2f}

Trade vertical: {vertical}
Market: {location}

Suggest a customer-facing quote price that:
1. Covers all costs
2. Achieves 25-35% gross margin
3. Is competitive for this market
4. Rounds to a clean number

Return ONLY a JSON object (no markdown):
{{
  "suggested_price": number,
  "margin_pct": number,
  "reasoning": "one sentence explanation"
}}"""

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw.strip())


# ── JOB SUMMARY ───────────────────────────────────────────────────────────────

async def generate_job_summary(
    job_title: str,
    scope: str,
    equipment_data: dict,
    field_notes: list[str]
) -> str:
    """
    Generate a readable job summary from field notes.
    Used in office view and job record.
    Only surfaces meaningful additions — routine confirmations are omitted.
    
    Returns:
        Plain English summary paragraph
    """
    client = _get_client()

    notes_text = "\n".join(
        f"- {note}" for note in field_notes
    ) if field_notes else "No field notes yet."

    prompt = f"""You are writing a job summary for a trades business owner.

Job: {job_title}
Scope: {scope}
Equipment: {json.dumps(equipment_data, indent=2)}

Field notes from technician:
{notes_text}

Write a concise, professional summary paragraph (3-5 sentences) that:
1. States what was done
2. Notes anything unexpected or notable (extra parts, issues found, pad conditions, etc.)
3. Notes any change orders
4. Ends with customer satisfaction if mentioned

Do NOT include routine confirmations ("installation went as planned", "system works").
Only surface things that matter to the office or owner.
Write in plain English — no bullet points, no headers.
Return ONLY the summary paragraph, nothing else."""

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}]
    )

    return message.content[0].text.strip()


# ── DASHBOARD FLAG GENERATION ─────────────────────────────────────────────────

async def generate_dashboard_flags(business_data: dict) -> list:
    """
    Analyze business data and generate actionable flags for the dashboard.
    
    Args:
        business_data: Dict containing jobs, invoices, estimates, patterns
    
    Returns:
        List of flag dicts with type, message, reasoning, and suggested_action
    """
    client = _get_client()

    prompt = f"""You are a business intelligence advisor for a small trades business.

Analyze this business data and identify the most important actionable items:

{json.dumps(business_data, indent=2)}

Return ONLY a JSON array of flags (no markdown), maximum 5 flags, most important first:
[
  {{
    "type": "overdue_invoice|cold_estimate|labor_drift|referral|restock|general",
    "priority": "high|medium|low",
    "title": "short title (5 words max)",
    "message": "one sentence describing the issue",
    "reasoning": "2-3 sentences explaining why this matters and the data behind it",
    "suggested_action": "specific action to take"
  }}
]"""

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw.strip())
