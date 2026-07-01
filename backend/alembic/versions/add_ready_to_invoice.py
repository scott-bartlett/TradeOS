"""Add ready_to_invoice status to jobs table"""
from alembic import op
import sqlalchemy as sa

revision = 'add_ready_to_invoice'
down_revision = 'add_co_field_capture'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("ALTER TYPE jobstatus ADD VALUE IF NOT EXISTS 'ready_to_invoice'")

def downgrade():
    pass  # Postgres enums can't remove values easily
