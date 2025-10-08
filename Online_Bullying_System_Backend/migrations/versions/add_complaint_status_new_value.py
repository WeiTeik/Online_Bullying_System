"""add new status value"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'add_complaint_status_new_value'
down_revision = 'add_complaints_tables'
branch_labels = None
depends_on = None


def upgrade():
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE complaintstatus ADD VALUE IF NOT EXISTS 'new'")
    op.execute("ALTER TABLE complaint ALTER COLUMN status DROP DEFAULT")
    op.execute("UPDATE complaint SET status='new' WHERE status='pending'")
    op.execute("ALTER TABLE complaint ALTER COLUMN status SET DEFAULT 'new'")


def downgrade():
    op.execute("ALTER TABLE complaint ALTER COLUMN status DROP DEFAULT")
    op.execute("UPDATE complaint SET status='pending' WHERE status='new'")
    op.execute("ALTER TABLE complaint ALTER COLUMN status SET DEFAULT 'pending'")
