"""Add field capture columns to change_orders"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'add_co_field_capture'
down_revision = 'add_co_line_items'
branch_labels = None
depends_on = None


def upgrade():
    # New status value — alter the enum
    op.execute("ALTER TYPE changeorderstatus ADD VALUE IF NOT EXISTS 'field_approved'")

    # New columns
    op.add_column('change_orders', sa.Column('rough_hours', sa.Numeric(5, 2), nullable=True))
    op.add_column('change_orders', sa.Column('rough_parts', sa.Text(), nullable=True))
    op.add_column('change_orders', sa.Column('customer_signed', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('change_orders', sa.Column('signature_data', sa.Text(), nullable=True))
    op.add_column('change_orders', sa.Column('captured_by_tech', UUID(as_uuid=True), nullable=True))


def downgrade():
    op.drop_column('change_orders', 'rough_hours')
    op.drop_column('change_orders', 'rough_parts')
    op.drop_column('change_orders', 'customer_signed')
    op.drop_column('change_orders', 'signature_data')
    op.drop_column('change_orders', 'captured_by_tech')
