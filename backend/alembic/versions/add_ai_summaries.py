"""Add ai_quote_summary and ai_invoice_summary columns"""
from alembic import op
import sqlalchemy as sa

revision = 'add_ai_summaries'
down_revision = 'add_ready_to_invoice'
branch_labels = None
depends_on = None

def upgrade():
    # Cache AI summaries on jobs and invoices
    op.add_column('jobs', sa.Column('ai_quote_summary', sa.Text(), nullable=True))
    op.add_column('invoices', sa.Column('ai_invoice_summary', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('jobs', 'ai_quote_summary')
    op.drop_column('invoices', 'ai_invoice_summary')
