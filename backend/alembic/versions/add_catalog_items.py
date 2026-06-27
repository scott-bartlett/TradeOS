"""add catalog_items table

Revision ID: add_catalog_items
Revises: 4d3895ad10bf
Create Date: 2026-06-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'add_catalog_items'
down_revision = '4d3895ad10bf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'catalog_items',
        sa.Column('id',             postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at',     sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at',     sa.DateTime(timezone=True), nullable=True),
        sa.Column('sku',            sa.String(100), nullable=False),
        sa.Column('description',    sa.String(500), nullable=False),
        sa.Column('category',       sa.String(100), nullable=True),
        sa.Column('unit',           sa.String(50),  nullable=True),
        sa.Column('unit_cost',      sa.Numeric(10, 2), nullable=True),
        sa.Column('markup_pct',     sa.Numeric(5, 4),  nullable=True),
        sa.Column('customer_price', sa.Numeric(10, 2), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sku'),
    )
    op.create_index('ix_catalog_items_sku', 'catalog_items', ['sku'])


def downgrade() -> None:
    op.drop_index('ix_catalog_items_sku', table_name='catalog_items')
    op.drop_table('catalog_items')
