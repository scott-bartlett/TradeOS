"""add deposit fields to jobs

Revision ID: add_deposit_fields
Revises: add_catalog_items
Create Date: 2026-06-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_deposit_fields'
down_revision = 'add_catalog_items'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('deposit_required', sa.Numeric(10, 2), nullable=True))
    op.add_column('jobs', sa.Column('deposit_received', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    op.drop_column('jobs', 'deposit_required')
    op.drop_column('jobs', 'deposit_received')
