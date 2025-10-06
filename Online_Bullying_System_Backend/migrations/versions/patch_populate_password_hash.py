"""populate password_hash for existing users and make column NOT NULL (idempotent)"""
from alembic import op
import sqlalchemy as sa
from werkzeug.security import generate_password_hash

# revision identifiers, used by Alembic.
revision = 'patch_populate_password_hash'
down_revision = 'b827e5e12926'
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('user')]

    # add column only if it does not exist (safe when another migration already added it)
    if 'password_hash' not in cols:
        op.add_column('user', sa.Column('password_hash', sa.String(length=512), nullable=True))

    # populate only rows where password_hash IS NULL
    temp_hash = generate_password_hash("ChangeMe123!")
    op.execute(sa.text('UPDATE "user" SET password_hash = :h WHERE password_hash IS NULL').bindparams(h=temp_hash))

    # ensure NOT NULL (safe because we've populated NULLs)
    op.alter_column('user', 'password_hash', existing_type=sa.String(length=512), nullable=False)


def downgrade():
    # if this migration was the one that added the column, drop it
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('user')]
    if 'password_hash' in cols:
        op.drop_column('user', 'password_hash')