"""add rejected status value"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_rejected_status_to_complaint"
down_revision = "add_complaint_status_new_value"
branch_labels = None
depends_on = None


def upgrade():
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE complaintstatus ADD VALUE IF NOT EXISTS 'rejected'")


def downgrade():
    # map any rejected complaints back to new before downgrading
    op.execute("UPDATE complaint SET status='new' WHERE status='rejected'")
