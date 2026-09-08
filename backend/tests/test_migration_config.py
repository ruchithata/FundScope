from pathlib import Path


def test_alembic_configuration_exists():
    backend_dir = Path(__file__).resolve().parents[1]
    config_path = backend_dir / "alembic.ini"
    env_path = backend_dir / "migrations" / "env.py"
    migration_path = (
        backend_dir
        / "migrations"
        / "versions"
        / "0001_add_data_provenance.py"
    )

    assert config_path.exists()
    assert env_path.exists()
    assert migration_path.exists()


def test_migration_has_expected_revision():
    backend_dir = Path(__file__).resolve().parents[1]
    migration = (
        backend_dir
        / "migrations"
        / "versions"
        / "0001_add_data_provenance.py"
    ).read_text(encoding="utf-8")

    assert 'revision: str = "0001_add_data_provenance"' in migration
    assert '"data_sources"' in migration
    assert '"data_quality"' in migration
    assert '"source_id"' in migration
