import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db.session import get_session
from app.main import create_app


class DummySession:
    async def rollback(self) -> None:
        return None


@pytest_asyncio.fixture
async def client():
    async def override_session():
        yield DummySession()

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client
