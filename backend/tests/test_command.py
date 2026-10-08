import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

TB = settings.tb_url


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@respx.mock
def test_quat_bat_ok(client):
    respx.post(f"{TB}/api/auth/login").respond(200, json={"token": "t1", "refreshToken": "r"})
    rpc = respx.post(url__regex=rf"{TB}/api/rpc/oneway/.*").respond(200)
    r = client.post("/api/command", json={"device": "quat", "action": "bat"})
    assert r.status_code == 200
    assert r.json()["success"] is True
    assert rpc.calls.last.request.headers["X-Authorization"] == "Bearer t1"


def test_invalid_device(client):
    r = client.post("/api/command", json={"device": "tv", "action": "bat"})
    assert r.status_code == 400


def test_invalid_action(client):
    r = client.post("/api/command", json={"device": "den", "action": "blink"})
    assert r.status_code == 400


@respx.mock
def test_relogin_on_401(client):
    login = respx.post(f"{TB}/api/auth/login")
    login.side_effect = [
        httpx.Response(200, json={"token": "old"}),
        httpx.Response(200, json={"token": "new"}),
    ]
    rpc = respx.post(url__regex=rf"{TB}/api/rpc/oneway/.*")
    rpc.side_effect = [httpx.Response(401), httpx.Response(200)]
    r = client.post("/api/command", json={"device": "den", "action": "tat"})
    assert r.status_code == 200
    assert login.call_count == 2
    assert rpc.calls.last.request.headers["X-Authorization"] == "Bearer new"


@respx.mock
def test_device_timeout(client):
    respx.post(f"{TB}/api/auth/login").respond(200, json={"token": "t"})
    respx.post(url__regex=rf"{TB}/api/rpc/oneway/.*").respond(504)
    r = client.post("/api/command", json={"device": "quat", "action": "tat"})
    assert r.status_code == 504


@respx.mock
def test_tb_error(client):
    respx.post(f"{TB}/api/auth/login").respond(200, json={"token": "t"})
    respx.post(url__regex=rf"{TB}/api/rpc/oneway/.*").respond(500, text="boom")
    r = client.post("/api/command", json={"device": "quat", "action": "bat"})
    assert r.status_code == 502


@pytest.mark.parametrize("body", [
    {"device": "unknown", "action": "unknown"},
    {"device": "quat", "action": "unknown"},
    {"device": "unknown", "action": "bat"},
])
def test_unknown_command(client, body):
    r = client.post("/api/command", json=body)
    assert r.status_code == 400
    assert r.json()["message"] == "Không hiểu lệnh, vui lòng nói lại."


from app import text_mapper
from app.text_mapper import MapperError, ParsedCommand


@respx.mock
def test_voice_ok(client, monkeypatch):
    monkeypatch.setattr(text_mapper, "classify_command",
                        lambda text: ParsedCommand(device="den", action="bat"))
    respx.post(f"{TB}/api/auth/login").respond(200, json={"token": "t"})
    respx.post(url__regex=rf"{TB}/api/rpc/oneway/.*").respond(200)
    r = client.post("/api/voice", json={"text": "bật đèn"})
    assert r.status_code == 200
    assert r.json()["command"] == {"device": "den", "action": "bat", "raw_text": "bật đèn"}


def test_voice_unknown(client, monkeypatch):
    monkeypatch.setattr(text_mapper, "classify_command",
                        lambda text: ParsedCommand(device="unknown", action="unknown"))
    r = client.post("/api/voice", json={"text": "hôm nay trời đẹp"})
    assert r.status_code == 400


def test_voice_mapper_error(client, monkeypatch):
    def boom(text):
        raise MapperError("quota")
    monkeypatch.setattr(text_mapper, "classify_command", boom)
    r = client.post("/api/voice", json={"text": "bật quạt"})
    assert r.status_code == 502


@respx.mock
def test_error_format(client):
    respx.post(f"{TB}/api/auth/login").respond(200, json={"token": "t"})
    respx.post(url__regex=rf"{TB}/api/rpc/oneway/.*").respond(504)
    r = client.post("/api/command", json={"device": "quat", "action": "bat"})
    assert r.json()["success"] is False
    assert r.json()["error"] == "DEVICE_OFFLINE"
    assert "message" in r.json()


def test_cors_voice_web(client):
    r = client.options("/api/voice", headers={
        "Origin": "http://localhost:5500", "Access-Control-Request-Method": "POST"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5500"
