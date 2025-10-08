"""add complaints and complaint_comments tables"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import expression

# revision identifiers, used by Alembic.
revision = 'add_complaints_tables'
down_revision = 'add_avatar_url_to_user'
branch_labels = None
depends_on = None


def upgrade():
    status_enum = sa.Enum('new', 'in_progress', 'resolved', name='complaintstatus')

    op.create_table(
        'complaint',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('reference_code', sa.String(length=32), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('student_name', sa.String(length=120), nullable=False),
        sa.Column('anonymous', sa.Boolean(), nullable=False, server_default=expression.false()),
        sa.Column('incident_type', sa.String(length=120), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('room_number', sa.String(length=64), nullable=True),
        sa.Column('incident_date', sa.Date(), nullable=True),
        sa.Column('witnesses', sa.Text(), nullable=True),
        sa.Column('attachments', sa.JSON(), nullable=True),
        sa.Column('status', status_enum, nullable=False, server_default='new'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('reference_code'),
    )

    op.create_table(
        'complaint_comment',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('complaint_id', sa.Integer(), sa.ForeignKey('complaint.id'), nullable=False),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('author_name', sa.String(length=120), nullable=False),
        sa.Column('author_role', sa.String(length=32), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('complaint_comment')
    op.drop_table('complaint')
    status_enum = sa.Enum('pending', 'in_progress', 'resolved', name='complaintstatus')
    status_enum.drop(op.get_bind(), checkfirst=False)
