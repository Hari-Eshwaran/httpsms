"""
httpSMS Python Client SDK & CLI
Allows programmatic sending, receiving, and monitoring of SMS messages.
"""

import sys
import json
import argparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime

class HttpSmsClient:
    def __init__(self, base_url="http://localhost:3000", api_key=None, default_sender="+18005550199"):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.default_sender = default_sender

    def _request(self, endpoint, method="GET", payload=None):
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key

        data = json.dumps(payload).encode("utf-8") if payload else None
        req = Request(url, data=data, headers=headers, method=method)

        try:
            with urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as e:
            error_body = e.read().decode("utf-8")
            raise RuntimeError(f"API Error {e.code}: {error_body}")
        except URLError as e:
            raise RuntimeError(f"Connection failed: {e.reason}")

    def send_sms(self, to, content, from_phone=None, sim="SIM1", attachments=None, send_at=None):
        """Send an SMS via the gateway."""
        payload = {
            "from": from_phone or self.default_sender,
            "to": to,
            "content": content,
            "sim": sim,
            "attachments": attachments or [],
            "send_at": send_at
        }
        return self._request("/v1/messages/send", method="POST", payload=payload)

    def receive_sms(self, from_phone, content, to_phone=None, sim="SIM1"):
        """Ingest or simulate receiving an SMS."""
        payload = {
            "from": from_phone,
            "to": to_phone or self.default_sender,
            "content": content,
            "sim": sim,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        return self._request("/v1/messages/receive", method="POST", payload=payload)

    def list_messages(self, owner=None, contact=None, query=None):
        """List messages filtered by query or phone."""
        params = []
        if owner: params.append(f"owner={owner}")
        if contact: params.append(f"contact={contact}")
        if query: params.append(f"query={query}")
        qs = f"?{'&'.join(params)}" if params else ""
        return self._request(f"/v1/messages{qs}")

    def get_threads(self):
        """Get message conversation threads."""
        return self._request("/v1/message-threads")

def main():
    parser = argparse.ArgumentParser(description="httpSMS Python CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Send command
    send_p = subparsers.add_parser("send", help="Send an SMS")
    send_p.add_argument("to", help="Recipient phone (+1...)")
    send_p.add_argument("content", help="Message content")
    send_p.add_argument("--from-phone", help="Sender phone")
    send_p.add_argument("--sim", default="SIM1", help="SIM slot")

    # Receive command
    rec_p = subparsers.add_parser("receive", help="Receive/simulate an incoming SMS")
    rec_p.add_argument("from_phone", help="Sender phone (+1...)")
    rec_p.add_argument("content", help="Message content")

    # List command
    list_p = subparsers.add_parser("list", help="List messages")

    # Threads command
    threads_p = subparsers.add_parser("threads", help="List conversation threads")

    args = parser.parse_args()
    client = HttpSmsClient()

    if args.command == "send":
        res = client.send_sms(args.to, args.content, from_phone=args.from_phone, sim=args.sim)
        print(f"[OK] Queued: {res.get('message')}")
        print(f"   ID:     {res['data']['id']}")
        print(f"   Status: {res['data']['status']}")
    elif args.command == "receive":
        res = client.receive_sms(args.from_phone, args.content)
        print(f"[OK] Received: {res.get('message')}")
        print(f"   ID:     {res['data']['id']}")
        print(f"   From:   {res['data']['contact']}")
    elif args.command == "list":
        res = client.list_messages()
        print(f"--- Messages ({len(res['data'])}) ---")
        for m in res['data']:
            direction = "[OUT]" if m['type'] == 'mobile-terminated' else "[IN ]"
            print(f"{direction} {m['status'].upper():9} | {m['contact']:14} | {m['content']}")
    elif args.command == "threads":
        res = client.get_threads()
        print(f"--- Conversation Threads ({len(res['data'])}) ---")
        for t in res['data']:
            print(f"{t['contact_name']} ({t['contact_phone']}): {t['total_messages']} msgs | Last: {t['last_message']}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
