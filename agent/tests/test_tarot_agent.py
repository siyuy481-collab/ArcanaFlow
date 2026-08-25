import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
TEST_DATABASE = Path(tempfile.gettempdir()) / f"arcana-unittest-{os.getpid()}.db"
TEST_DATABASE.unlink(missing_ok=True)
os.environ["ARCANA_DB_PATH"] = str(TEST_DATABASE)
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["MINDS_API_KEY"] = ""
os.environ["MINDS_SPARK_ID"] = ""

import agent  # noqa: E402
import main  # noqa: E402
import minds_client  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class TarotApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        TEST_DATABASE.unlink(missing_ok=True)

    def test_tarot_api_uses_cards_from_frontend(self):
        cards = [{
            "position": "核心牌 / 当下指引",
            "name": "星星",
            "arcana": "大阿卡那",
            "direction": "正位",
            "meaning": "希望、疗愈与重新看见方向",
        }]
        response = self.client.post(
            "/api/tarot",
            json={"question": "我下一步该关注什么？", "cards": cards},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["cards"], cards)
        self.assertIn("我下一步该关注什么", response.json()["result"])

    def test_fallback_reading_is_readable_when_model_is_unavailable(self):
        cards = [{
            "position": "核心牌 / 当下指引",
            "name": "力量",
            "arcana": "大阿卡那",
            "direction": "正位",
            "meaning": "勇气、耐心与内在力量",
        }]
        with patch.object(agent, "tarot_chain", None):
            result = agent.run_tarot_reading("如何面对当前压力？", cards)
        self.assertIn("如何面对当前压力", result["result"])
        self.assertIn("力量", result["result"])
        self.assertNotIn("DEEPSEEK_API_KEY", result["result"])
        self.assertNotIn("未连接在线", result["result"])

    def test_fallback_reading_follows_requested_language(self):
        cards = [{
            "position": "Core",
            "name": "The Star",
            "arcana": "Major Arcana",
            "direction": "Upright",
            "meaning": "Hope and renewed direction",
        }]
        english = agent.run_tarot_reading("What should I focus on?", cards, locale="en")
        japanese = agent.run_tarot_reading("何に集中すべきですか？", cards, locale="ja")
        self.assertIn("the cards offer", english["result"])
        self.assertIn("カード", japanese["result"])

    def test_pet_chat_stays_inside_the_site_and_has_local_fallback(self):
        response = self.client.post("/api/pet/chat", json={
            "message": "我现在有点犹豫，不知道该怎么问牌。",
            "history": [],
            "locale": "zh",
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["reply"].strip())
        self.assertNotIn("HelloMinds", response.json()["reply"])
        english = self.client.post("/api/pet/chat", json={
            "message": "I need help clarifying my question.",
            "history": [],
            "locale": "en",
        })
        japanese = self.client.post("/api/pet/chat", json={
            "message": "質問を整理したいです。",
            "history": [],
            "locale": "ja",
        })
        self.assertEqual(english.status_code, 200)
        self.assertEqual(japanese.status_code, 200)
        self.assertIn("I hear you", english.json()["reply"])
        self.assertIn("聞いているよ", japanese.json()["reply"])

    def test_desktop_pet_draw_returns_one_real_card_and_short_reading(self):
        response = self.client.post("/api/pet/draw", json={
            "keyword": "新的工作机会",
            "locale": "zh",
        })
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertGreaterEqual(payload["card_id"], 0)
        self.assertLessEqual(payload["card_id"], 21)
        self.assertEqual(payload["card"]["position"], "核心牌 / 当下指引")
        self.assertIn(payload["card"]["name"], payload["reply"])

    def test_pet_mind_is_one_turn_with_keywords_card_and_reading(self):
        status_response = self.client.get("/api/pet/mind/status")
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.json(), {
            "configured": False,
            "provider": "local",
            "mode": "single-turn",
        })
        response = self.client.post("/api/pet/mind", json={
            "message": "最近的工作选择让我很焦虑",
            "locale": "zh",
        })
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["provider"], "local")
        self.assertTrue(payload["keywords"])
        self.assertIn("工作", payload["keywords"])
        self.assertGreaterEqual(payload["card_id"], 0)
        self.assertLessEqual(payload["card_id"], 21)
        self.assertTrue(payload["reply"].strip())
        self.assertIn(payload["card"]["name"], payload["reading"])

    def test_pet_mind_calls_one_configured_mind_exactly_once(self):
        mind_result = {
            "reply": "我听见了你对这次选择的顾虑。",
            "keywords": ["选择", "顾虑"],
            "reading": "这张牌提醒你先确认能被事实验证的部分。",
        }
        with (
            patch.object(agent, "minds_is_configured", return_value=True),
            patch.object(agent, "run_mind_single_turn", return_value=mind_result) as mind_call,
        ):
            response = self.client.post("/api/pet/mind", json={
                "message": "我该怎样面对这次选择？",
                "locale": "zh",
            })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["provider"], "minds")
        self.assertEqual(response.json()["keywords"], ["选择", "顾虑"])
        mind_call.assert_called_once()
        args = mind_call.call_args.args
        self.assertEqual(args[0], "我该怎样面对这次选择？")
        self.assertEqual(args[2], "zh")

    def test_minds_client_sends_one_stateless_structured_message(self):
        captured = []

        class FakeResponse:
            def __init__(self, payload):
                self.payload = payload

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return json.dumps(self.payload).encode("utf-8")

        def fake_urlopen(request, timeout):
            captured.append((request, timeout))
            if request.full_url.endswith("/v1/messaging/conversation"):
                return FakeResponse({"conversationId": "conversation-test", "alias": "arcana-test"})
            if request.full_url.endswith("/v1/messaging/message"):
                return FakeResponse({"messageId": "message-test", "alias": "arcana-test"})
            if "/v1/messaging/histories/arcana-test" in request.full_url:
                return FakeResponse([{
                    "senderType": 0,
                    "messageText": json.dumps({
                        "reply": "A quiet reply",
                        "keywords": ["career", "choice"],
                        "reading": "A concise reading",
                    }),
                }])
            self.fail(f"Unexpected URL: {request.full_url}")

        card = {"name": "The Star", "direction": "Upright", "meaning": "Hope"}
        with (
            patch.object(minds_client, "MINDS_API_KEY", "minds_test_key"),
            patch.object(minds_client, "MINDS_SPARK_ID", "spark test"),
            patch.object(minds_client, "MINDS_API_BASE", "https://api.build.hellominds.ai"),
            patch.object(minds_client, "_conversation_alias", return_value="arcana-test"),
            patch.object(minds_client.urllib.request, "urlopen", side_effect=fake_urlopen),
        ):
            result = minds_client.run_mind_single_turn("What should I choose?", card, "en")

        create_request = captured[0][0]
        create_body = json.loads(create_request.data.decode("utf-8"))
        self.assertTrue(create_request.full_url.endswith("/v1/messaging/conversation"))
        self.assertEqual(create_request.get_header("X-api-key"), "minds_test_key")
        self.assertEqual(create_body["mindId"], "spark test")
        self.assertEqual(create_body["alias"], "arcana-test")

        message_request = captured[1][0]
        message_body = json.loads(message_request.data.decode("utf-8"))
        self.assertTrue(message_request.full_url.endswith("/v1/messaging/message"))
        self.assertEqual(message_body["alias"], "arcana-test")
        self.assertIn("Return ONLY valid JSON", message_body["messageText"])
        self.assertIn("What should I choose?", message_body["messageText"])
        self.assertEqual(result["keywords"], ["career", "choice"])

    def test_register_login_and_private_reading_history(self):
        registration = self.client.post("/api/auth/register", json={
            "username": "local_tester",
            "email": "local@example.com",
            "password": "local-test-2026",
        })
        self.assertEqual(registration.status_code, 201, registration.text)
        token = registration.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        self.assertEqual(self.client.get("/api/auth/me", headers=headers).status_code, 200)
        self.assertEqual(
            self.client.post("/api/auth/login", json={
                "identifier": "local_tester",
                "password": "wrong-password",
            }).status_code,
            401,
        )
        login = self.client.post("/api/auth/login", json={
            "identifier": "local@example.com",
            "password": "local-test-2026",
        })
        self.assertEqual(login.status_code, 200)
        login_headers = {"Authorization": f"Bearer {login.json()['token']}"}
        self.assertEqual(self.client.post("/api/auth/logout", headers=login_headers).status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me", headers=login_headers).status_code, 401)

        saved = self.client.post("/api/readings", headers=headers, json={
            "title": "职业方向",
            "question": "未来三个月我该如何调整职业方向？",
            "cards": [{
                "position": "核心牌 / 当下指引",
                "name": "星星",
                "arcana": "大阿卡那",
                "direction": "正位",
                "meaning": "希望与方向",
            }],
            "result": "先确认希望积累的能力，再安排一个可验证的小行动。",
        })
        self.assertEqual(saved.status_code, 201, saved.text)
        reading_id = saved.json()["id"]

        history = self.client.get("/api/readings", headers=headers)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.json()), 1)
        self.assertEqual(
            self.client.get(f"/api/readings/{reading_id}", headers=headers).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(f"/api/readings/{reading_id}").status_code,
            401,
        )


if __name__ == "__main__":
    unittest.main()
