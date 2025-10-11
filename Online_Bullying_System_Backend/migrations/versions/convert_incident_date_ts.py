"""convert incident_date column to timezone aware timestamp"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, time
from zoneinfo import ZoneInfo

# revision identifiers, used by Alembic.
revision = "convert_incident_date_ts"
down_revision = "add_rejected_status_to_complaint"
branch_labels = None
depends_on = None


def upgrade():
    tz = ZoneInfo("Asia/Kuala_Lumpur")

    with op.batch_alter_table("complaint") as batch_op:
        batch_op.add_column(sa.Column("incident_date_ts", sa.DateTime(timezone=True), nullable=True))

    bind = op.get_bind()
    complaint_table = sa.table(
        "complaint",
        sa.column("id", sa.Integer),
        sa.column("incident_date", sa.Date),
        sa.column("incident_date_ts", sa.DateTime(timezone=True)),
    )

    rows = bind.execute(sa.select(complaint_table.c.id, complaint_table.c.incident_date)).fetchall()
    for complaint_id, original_value in rows:
        if original_value is None:
            continue
        if isinstance(original_value, datetime):
            if original_value.tzinfo:
                converted = original_value.astimezone(tz)
            else:
                converted = original_value.replace(tzinfo=tz)
        else:
            converted = datetime.combine(original_value, time.min).replace(tzinfo=tz)

        bind.execute(
            complaint_table.update()
            .where(complaint_table.c.id == complaint_id)
            .values(incident_date_ts=converted)
        )

    with op.batch_alter_table("complaint") as batch_op:
        batch_op.drop_column("incident_date")
        batch_op.alter_column(
            "incident_date_ts",
            new_column_name="incident_date",
            existing_type=sa.DateTime(timezone=True),
            existing_nullable=True,
        )


def downgrade():
    tz = ZoneInfo("Asia/Kuala_Lumpur")

    with op.batch_alter_table("complaint") as batch_op:
        batch_op.add_column(sa.Column("incident_date_date", sa.Date(), nullable=True))

    bind = op.get_bind()
    complaint_table = sa.table(
        "complaint",
        sa.column("id", sa.Integer),
        sa.column("incident_date", sa.DateTime(timezone=True)),
        sa.column("incident_date_date", sa.Date),
    )

    rows = bind.execute(sa.select(complaint_table.c.id, complaint_table.c.incident_date)).fetchall()
    for complaint_id, original_value in rows:
        if original_value is None:
            continue
        if isinstance(original_value, datetime):
            if original_value.tzinfo:
                converted = original_value.astimezone(tz).date()
            else:
                converted = original_value.date()
        else:
            converted = original_value

        bind.execute(
            complaint_table.update()
            .where(complaint_table.c.id == complaint_id)
            .values(incident_date_date=converted)
        )

    with op.batch_alter_table("complaint") as batch_op:
        batch_op.drop_column("incident_date")
        batch_op.alter_column(
            "incident_date_date",
            new_column_name="incident_date",
            existing_type=sa.Date(),
            existing_nullable=True,
        )
