"""Add line_items JSONB column to change_orders table"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'add_co_line_items'
down_revision = 'add_deposit_fields'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('change_orders',
        sa.Column('line_items', JSONB, nullable=True)
    )
    op.add_column('change_orders',
        sa.Column('extra_hours', sa.Numeric(5, 2), nullable=True)
    )

def downgrade():
    op.drop_column('change_orders', 'line_items')
    op.drop_column('change_orders', 'extra_hours')
