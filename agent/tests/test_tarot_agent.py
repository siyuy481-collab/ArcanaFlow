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
os.environ["OPENAI_API_KEY"] = ""
os.environ["OPENAI_MODEL"] = "gpt-5.6-luna"

import agent  # noqa: E402
import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from langchain_core.runnables import Runnable  # noqa: E402


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
        self.assertNotIn("OPENAI_API_KEY", result["result"])
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
        self.assertNotIn("API", response.json()["reply"])
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

    def test_pet_mind_calls_one_configured_langchain_agent_exactly_once(self):
        class FakePetMindResult:
            def model_dump(self):
                return {
                    "reply": "我听见了你对这次选择的顾虑。",
                    "keywords": ["选择", "顾虑"],
                    "reading": "这张牌提醒你先确认能被事实验证的部分。",
                }

        with patch.object(agent, "pet_mind_chain") as pet_mind_chain:
            pet_mind_chain.invoke.return_value = FakePetMindResult()
            response = self.client.post("/api/pet/mind", json={
                "message": "我该怎样面对这次选择？",
                "locale": "zh",
            })

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["provider"], "langchain")
        self.assertEqual(response.json()["keywords"], ["选择", "顾虑"])
        pet_mind_chain.invoke.assert_called_once()
        call_input = pet_mind_chain.invoke.call_args.args[0]
        self.assertEqual(call_input["message"], "我该怎样面对这次选择？")
        self.assertIn("牌名", call_input["cards"])

    def test_pet_mind_agent_is_a_langchain_pipeline(self):
        self.assertIsInstance(agent.pet_mind_prompt, Runnable)
        self.assertIsInstance(agent.pet_mind_parser, Runnable)
        parsed = agent.pet_mind_parser.invoke(json.dumps({
            "reply": "我听见了你对这次选择的顾虑。",
            "keywords": ["选择", "顾虑"],
            "reading": "这张牌提醒你先确认能被事实验证的部分。",
        }))
        self.assertEqual(parsed.keywords, ["选择", "顾虑"])

    def test_pet_mind_falls_back_when_langchain_agent_fails(self):
        with patch.object(agent, "pet_mind_chain") as pet_mind_chain:
            pet_mind_chain.invoke.side_effect = ValueError("invalid structured output")
            response = self.client.post("/api/pet/mind", json={
                "message": "我该怎样面对这次选择？",
                "locale": "zh",
            })

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["provider"], "local")
        self.assertTrue(response.json()["reply"].strip())
        self.assertTrue(response.json()["keywords"])

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
