"""add fields to support student invitations"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_student_management_fields"
down_revision = "convert_incident_date_ts"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("user") as batch_op:
        batch_op.add_column(sa.Column("full_name", sa.String(length=120), nullable=True))
        batch_op.add_column(
            sa.Column("status", sa.String(length=32), nullable=False, server_default="active")
        )
        batch_op.add_column(sa.Column("invited_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))

    conn = op.get_bind()
    conn.execute(sa.text('UPDATE "user" SET full_name = username WHERE full_name IS NULL'))
    conn.execute(sa.text('UPDATE "user" SET status = \'active\' WHERE status IS NULL'))

    with op.batch_alter_table("user") as batch_op:
        batch_op.alter_column("status", server_default=None)


def downgrade():
    with op.batch_alter_table("user") as batch_op:
        batch_op.drop_column("last_login_at")
        batch_op.drop_column("invited_at")
        batch_op.drop_column("status")
        batch_op.drop_column("full_name")
