from __future__ import with_statement

from logging.config import fileConfig

from alembic import context
from flask import current_app

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def get_engine():
    db_ext = current_app.extensions["migrate"].db
    try:
        return db_ext.get_engine()
    except (TypeError, AttributeError):
        return db_ext.engine


def get_engine_url():
    return str(get_engine().url).replace("%", "%%")


def get_metadata():
    db_ext = current_app.extensions["migrate"].db
    if hasattr(db_ext, "metadatas"):
        return db_ext.metadatas[None]
    return db_ext.metadata


config.set_main_option("sqlalchemy.url", get_engine_url())
target_metadata = get_metadata()


def process_revision_directives(migration_context, revision, directives):
    if getattr(config.cmd_opts, "autogenerate", False):
        script = directives[0]
        if script.upgrade_ops.is_empty():
            directives[:] = []
            print("No schema changes detected.")


def run_migrations_offline():
    context.configure(
        url=get_engine_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=True,
            process_revision_directives=process_revision_directives,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
