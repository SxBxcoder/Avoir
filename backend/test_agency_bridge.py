"""Unit tests for AgencyBridge DynamoDB persistence and local fallback.

Run: python -m unittest test_agency_bridge -v
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import agency_bridge as agency_module
from agency_bridge import AgencyBridge


def make_mock_table():
    """A mock boto3 Table with the pieces AgencyBridge touches."""
    table = MagicMock()
    table.meta.client.exceptions.ConditionalCheckFailedException = type(
        "ConditionalCheckFailedException", (Exception,), {}
    )
    table.load.return_value = None
    table.query.return_value = {"Items": []}
    table.get_item.return_value = {}
    return table


def make_bridge_with_table(table):
    resource = MagicMock()
    resource.Table.return_value = table
    return AgencyBridge(dynamo_resource=resource)


class FallbackModeTests(unittest.TestCase):
    """When DynamoDB is unavailable, behavior must match the legacy store."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self._old_cwd = os.getcwd()
        os.chdir(self.tmpdir)
        self.bridge = AgencyBridge()
        # Force fallback mode deterministically: skip the lazy DynamoDB probe
        # entirely so tests never touch real AWS endpoints/credentials.
        self.bridge._dynamo_checked = True
        self.bridge._table = None

    def tearDown(self):
        os.chdir(self._old_cwd)

    def test_falls_back_to_file_store_when_boto3_missing(self):
        self.assertIsNone(self.bridge._get_table())

    def test_share_link_persists_to_file_and_roundtrips(self):
        link = self.bridge.generate_share_link("ag1", {"hook": "h", "offer": "o", "cta": "c"})
        link_id = link.rsplit("/", 1)[-1]

        campaign = self.bridge.get_shared_campaign(link_id)
        self.assertEqual(campaign["hook"], "h")
        self.assertEqual(campaign["status"], "PENDING_APPROVAL")

        # A fresh instance must read it back from the file.
        reloaded = AgencyBridge()
        self.assertIsNotNone(reloaded.get_shared_campaign(link_id))

    def test_add_feedback_appends_thread(self):
        link = self.bridge.generate_share_link("ag1", {"hook": "h"})
        link_id = link.rsplit("/", 1)[-1]

        result = self.bridge.add_feedback(link_id, "make it punchier", "client")
        self.assertEqual(len(result["thread"]), 1)
        self.assertEqual(result["thread"][0]["sender"], "client")
        self.assertEqual(
            self.bridge.get_shared_campaign(link_id)["thread"][0]["text"],
            "make it punchier",
        )

    def test_update_variant_merges_and_preserves_missing_fields(self):
        link = self.bridge.generate_share_link("ag1", {"hook": "h", "offer": "keep me"})
        link_id = link.rsplit("/", 1)[-1]

        updated = self.bridge.update_campaign_variant(link_id, {"hook": "new hook"})
        self.assertEqual(updated["hook"], "new hook")
        self.assertEqual(updated["offer"], "keep me")
        self.assertEqual(updated["cta"], "")

    def test_unknown_link_returns_none(self):
        self.assertIsNone(self.bridge.get_shared_campaign("nope"))
        self.assertIsNone(self.bridge.add_feedback("nope", "x"))
        self.assertIsNone(self.bridge.update_campaign_variant("nope", {}))


class DynamoModeTests(unittest.TestCase):
    """When the table is reachable, reads/writes must hit DynamoDB."""

    def setUp(self):
        self.table = make_mock_table()
        self.bridge = make_bridge_with_table(self.table)
        self.tmpdir = tempfile.mkdtemp()
        self._old_cwd = os.getcwd()
        os.chdir(self.tmpdir)  # isolate any fallback file writes

    def tearDown(self):
        os.chdir(self._old_cwd)

    def test_uses_dynamodb_table_and_seeds_demo_clients(self):
        self.bridge._get_table()
        self.assertTrue(self.table.load.called)
        # 3 demo clients seeded with attribute_not_exists guards.
        put_calls = self.table.put_item.call_args_list
        self.assertEqual(len(put_calls), 3)
        for call in put_calls:
            self.assertIn("attribute_not_exists(pk)", call.kwargs["ConditionExpression"])
            self.assertEqual(call.kwargs["Item"]["pk"], "CLIENT")

    def test_generate_share_link_writes_campaign_item(self):
        link = self.bridge.generate_share_link("ag1", {"hook": "h"})
        link_id = link.rsplit("/", 1)[-1]

        campaign_puts = [
            c for c in self.table.put_item.call_args_list
            if c.kwargs["Item"].get("pk") == "CAMPAIGN"
        ]
        self.assertEqual(len(campaign_puts), 1)
        item = campaign_puts[0].kwargs["Item"]
        self.assertEqual(item["sk"], link_id)
        self.assertEqual(item["agency_id"], "ag1")
        self.assertEqual(item["status"], "PENDING_APPROVAL")
        # Fallback store untouched in Dynamo mode.
        self.assertNotIn(link_id, self.bridge.shared_campaigns)

    def test_get_shared_campaign_reads_from_dynamo_and_strips_keys(self):
        self.bridge._get_table()
        self.table.get_item.return_value = {
            "Item": {
                "pk": "CAMPAIGN",
                "sk": "link9",
                "hook": "h",
                "thread": [{"sender": "client", "text": "hi", "timestamp": 1}],
            }
        }
        campaign = self.bridge.get_shared_campaign("link9")
        self.assertEqual(campaign["hook"], "h")
        self.assertNotIn("pk", campaign)
        self.assertNotIn("sk", campaign)

    def test_get_clients_queries_client_partition(self):
        self.bridge._get_table()
        self.table.query.return_value = {
            "Items": [
                {"pk": "CLIENT", "sk": "c1", "name": "Acme", "industry": "Tech", "logo": None, "agency_id": "ag1"}
            ]
        }
        clients = self.bridge.get_clients("ag1")
        self.assertEqual(clients[0]["id"], "c1")
        self.assertEqual(clients[0]["name"], "Acme")
        # Queried exactly once against the CLIENT partition.
        self.table.query.assert_called_once()
        self.assertIn("KeyConditionExpression", self.table.query.call_args.kwargs)

    def test_add_feedback_read_modify_write_via_dynamo(self):
        self.bridge._get_table()
        self.table.get_item.return_value = {
            "Item": {"pk": "CAMPAIGN", "sk": "link9", "hook": "h", "thread": []}
        }
        result = self.bridge.add_feedback("link9", "love it", "client")
        self.assertEqual(len(result["thread"]), 1)
        # Re-persisted with pk/sk restored.
        last_put = self.table.put_item.call_args_list[-1].kwargs["Item"]
        self.assertEqual(last_put["pk"], "CAMPAIGN")
        self.assertEqual(last_put["sk"], "link9")


class DegradationTests(unittest.TestCase):
    """Storage errors must degrade to fallback, never raise to endpoints."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self._old_cwd = os.getcwd()
        os.chdir(self.tmpdir)

    def tearDown(self):
        os.chdir(self._old_cwd)

    def test_missing_table_downgrades_to_fallback(self):
        resource = MagicMock()
        resource.Table.return_value.load.side_effect = Exception("ResourceNotFound")
        bridge = AgencyBridge(dynamo_resource=resource)

        self.assertIsNone(bridge._get_table())
        link = bridge.generate_share_link("ag1", {"hook": "h"})
        self.assertIsNotNone(bridge.get_shared_campaign(link.rsplit("/", 1)[-1]))

    def test_put_failure_falls_back_mid_request(self):
        table = make_mock_table()
        table.put_item.side_effect = Exception("ProvisionedThroughputExceeded")
        resource = MagicMock()
        resource.Table.return_value = table
        bridge = AgencyBridge(dynamo_resource=resource)

        link = bridge.generate_share_link("ag1", {"hook": "h"})
        link_id = link.rsplit("/", 1)[-1]
        self.assertIn(link_id, bridge.shared_campaigns)
        self.assertIsNotNone(bridge.get_shared_campaign(link_id))

    def test_seed_failure_does_not_break_connect(self):
        table = make_mock_table()
        table.put_item.side_effect = Exception("seed boom")
        resource = MagicMock()
        resource.Table.return_value = table

        bridge = AgencyBridge(dynamo_resource=resource)
        self.assertIsNotNone(bridge._get_table())  # still connected


if __name__ == "__main__":
    unittest.main()
