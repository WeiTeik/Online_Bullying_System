"""add password_hash to user (safe nullable->populate->not null)"""

from alembic import op
import sqlalchemy as sa
from werkzeug.security import generate_password_hash

# revision identifiers, used by Alembic.
revision = 'b827e5e12926'
down_revision = 'f603da337792'
branch_labels = None
depends_on = None

def upgrade():
    # add column as nullable with sufficient length
    op.add_column('user', sa.Column('password_hash', sa.String(length=512), nullable=True))

    # populate existing rows (only update NULLs); temporary password
    temp_hash = generate_password_hash("ChangeMe123!")
    op.execute(sa.text('UPDATE "user" SET password_hash = :h WHERE password_hash IS NULL').bindparams(h=temp_hash))

    # make NOT NULL
    op.alter_column('user', 'password_hash', existing_type=sa.String(length=512), nullable=False)


def downgrade():
    op.drop_column('user', 'password_hash')
